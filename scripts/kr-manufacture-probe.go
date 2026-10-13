// This file is copied into a temporary bdo-data-extractor checkout by
// extract-bdo-client.ps1. It must live inside that module to access its
// internal PAZ and BSS decoders; it is not a standalone Go program.
package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/idevelopthings/bdo-data-extractor/internal/paz"
	"github.com/idevelopthings/bdo-data-extractor/internal/tables"
)

func main() {
	if len(os.Args) != 3 {
		fmt.Fprintln(os.Stderr, "usage: kr-manufacture-probe <gameDir> <output.json>")
		os.Exit(2)
	}
	src, err := paz.OpenSource(os.Args[1])
	if err != nil {
		panic(err)
	}
	defer src.Close()

	data, err := src.Read("manufacture.bss")
	if err != nil {
		panic(err)
	}
	recipes, err := tables.DecodeManufacture(data)
	if err != nil {
		panic(err)
	}
	encoded, err := json.MarshalIndent(recipes, "", "  ")
	if err != nil {
		panic(err)
	}
	if err := os.WriteFile(os.Args[2], encoded, 0o644); err != nil {
		panic(err)
	}
	fmt.Printf("decoded %d manufacture recipes\n", len(recipes))
}
