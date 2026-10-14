// This file is copied into a temporary bdo-data-extractor checkout by
// extract-bdo-client.ps1. It must live inside that module to access its
// internal PAZ and BSS decoders; it is not a standalone Go program.
package main

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"os"
	"unicode/utf16"

	"github.com/idevelopthings/bdo-data-extractor/internal/bss"
	"github.com/idevelopthings/bdo-data-extractor/internal/paz"
)

const maxPublicItemID = 10_000_000

// inlineName reads the UTF-16 display name immediately preceding the embedded
// icon path. Unlike the global clients' .loc file, the Korean client keeps
// this localized name directly in each itemenchant record.
func inlineName(record []byte) (string, bool) {
	iconStart := bytes.Index(record, []byte("New_Icon"))
	if iconStart < 16 {
		return "", false
	}
	nameEnd := iconStart - 8 // icon's int64-length prefix
	for characters := 1; characters <= 120; characters++ {
		nameLengthOffset := nameEnd - 8 - characters*2
		if nameLengthOffset < 4 {
			break
		}
		if int(int64(binary.LittleEndian.Uint64(record[nameLengthOffset:nameLengthOffset+8]))) != characters {
			continue
		}
		codeUnits := make([]uint16, characters)
		for index := range codeUnits {
			start := nameLengthOffset + 8 + index*2
			codeUnits[index] = binary.LittleEndian.Uint16(record[start : start+2])
		}
		return string(utf16.Decode(codeUnits)), true
	}
	return "", false
}

func main() {
	if len(os.Args) != 3 {
		fmt.Fprintln(os.Stderr, "usage: kr-item-name-probe <gameDir> <output.json>")
		os.Exit(2)
	}

	source, err := paz.OpenSource(os.Args[1])
	if err != nil {
		panic(err)
	}
	defer source.Close()

	data, err := source.Read("itemenchant.dbss")
	if err != nil {
		panic(err)
	}
	offsets, err := source.Read("itemenchantoffset.dbss")
	if err != nil {
		panic(err)
	}
	index, err := bss.ParseOffsetIndex(offsets, len(data))
	if err != nil {
		panic(err)
	}

	names := make(map[string]string)
	for _, entry := range index {
		if entry.Key >= maxPublicItemID {
			continue
		}
		record, ok := entry.Slice(data)
		if !ok || len(record) < 4 || bss.U32(record, 0) != entry.Key {
			continue
		}
		name, ok := inlineName(record)
		if ok && name != "" {
			names[fmt.Sprint(entry.Key)] = name
		}
	}

	output := struct {
		SchemaVersion int               `json:"schemaVersion"`
		Locale        string            `json:"locale"`
		Names         map[string]string `json:"names"`
	}{SchemaVersion: 1, Locale: "ko", Names: names}
	encoded, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		panic(err)
	}
	if err := os.WriteFile(os.Args[2], append(encoded, '\n'), 0o644); err != nil {
		panic(err)
	}
	fmt.Printf("decoded %d Korean item names\n", len(names))
}
