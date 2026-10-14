// Compiled inside the pinned extractor module; reads game tables without LOC.
package main

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/idevelopthings/bdo-data-extractor/internal/bss"
	"github.com/idevelopthings/bdo-data-extractor/internal/paz"
	"github.com/idevelopthings/bdo-data-extractor/internal/tables"
	"github.com/idevelopthings/bdo-data-extractor/src/model"
)

type Detail struct {
	Name            string             `json:"name"`
	Description     string             `json:"description,omitempty"`
	PostIconStrings []string           `json:"postIconStrings,omitempty"`
	Enhancement     *model.Enhancement `json:"enhancement,omitempty"`
}

func main() {
	if len(os.Args) != 3 {
		panic("usage: kr-item-details-probe <gameDir> <output.json>")
	}
	src, err := paz.OpenSource(os.Args[1])
	if err != nil {
		panic(err)
	}
	defer src.Close()
	read := func(name string) []byte {
		value, e := src.Read(name)
		if e != nil {
			panic(e)
		}
		return value
	}
	data := read("itemenchant.dbss")
	index, err := bss.ParseOffsetIndex(read("itemenchantoffset.dbss"), len(data))
	if err != nil {
		panic(err)
	}
	curves, err := tables.DecodeEnchantCurves(read("enchantstaticstatusoffset.dbss"), read("enchantstaticstatus.dbss"))
	if err != nil {
		panic(err)
	}
	details := map[string]Detail{}
	descriptions, ships := 0, 0
	for _, entry := range index {
		if entry.Key >= 10000000 {
			continue
		}
		rec, ok := entry.Slice(data)
		if !ok || len(rec) < 4 || bss.U32(rec, 0) != entry.Key {
			continue
		}
		icon := bytes.Index(rec, []byte("New_Icon"))
		if icon < 16 {
			continue
		}
		end := icon - 8
		name, key := "", uint32(0)
		for n := 1; n <= 120; n++ {
			at := end - 8 - n*2
			if at < 4 {
				break
			}
			if int(int64(binary.LittleEndian.Uint64(rec[at:at+8]))) != n {
				continue
			}
			name = bss.DecodeUTF16(rec[at+8 : end])
			key = bss.U32(rec, at-4)
			break
		}
		if name == "" {
			continue
		}
		d := Detail{Name: name}
		iconEnd := icon + int(int64(binary.LittleEndian.Uint64(rec[icon-8:icon])))
		if iconEnd+18 < len(rec) {
			c := bss.NewCursor(rec, iconEnd+18, len(rec))
			for i := 0; i < 3; i++ {
				text := c.UTF16()
				if text != "" {
					d.PostIconStrings = append(d.PostIconStrings, text)
				}
			}
		}
		curve := curves[key]
		if curve != nil {
			for _, level := range curve.Levels {
				if level.Level == 0 && level.SourceDescription != "" {
					d.Description = level.SourceDescription
					descriptions++
					break
				}
			}
			if strings.Contains(name, "에페리아") || strings.Contains(name, "치로의") || strings.Contains(name, "토로의") || strings.Contains(name, "팔라시의") {
				d.Enhancement = curve
				ships++
			}
		}
		details[fmt.Sprint(entry.Key)] = d
	}
	value, err := json.MarshalIndent(struct {
		Items map[string]Detail `json:"items"`
	}{details}, "", "  ")
	if err != nil {
		panic(err)
	}
	if err = os.WriteFile(os.Args[2], value, 0644); err != nil {
		panic(err)
	}
	fmt.Printf("items=%d descriptions=%d shipCurves=%d\n", len(details), descriptions, ships)
}
