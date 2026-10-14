// Extract Korean source text from the global client's common item XMLs.
package main

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"unicode/utf8"

	"github.com/idevelopthings/bdo-data-extractor/internal/paz"
)

type Node struct {
	XMLName  xml.Name
	Text     string `xml:",chardata"`
	Children []Node `xml:",any"`
}
type ItemText struct {
	Name        string `json:"name,omitempty"`
	Description string `json:"description"`
	SourcePath  string `json:"sourcePath"`
	SourceKind  string `json:"sourceKind"`
}

func field(node Node, name string) string {
	for _, child := range node.Children {
		if child.XMLName.Local == name {
			return child.Text
		}
	}
	return ""
}
func main() {
	if len(os.Args) != 3 {
		panic("usage: global-korean-text-probe <gameDir> <output.json>")
	}
	source, err := paz.OpenSource(os.Args[1])
	if err != nil {
		panic(err)
	}
	defer source.Close()
	texts := map[string]ItemText{}
	basePath := regexp.MustCompile(`(?i)ui_html/xml/[0-9]+\.xml$`)
	hangul := regexp.MustCompile(`[가-힣]`)
	count, invalid := 0, 0
	add := func(id, name, description, path, kind string) {
		if _, e := strconv.ParseUint(id, 10, 32); e != nil || description == "" || !hangul.MatchString(description) {
			return
		}
		if previous, ok := texts[id]; ok && previous.SourceKind == "item" {
			return
		}
		texts[id] = ItemText{Name: name, Description: description, SourcePath: path, SourceKind: kind}
	}
	for _, i := range source.Index.FilesUnder("ui_html/xml") {
		path := source.Index.Path(i)
		if !basePath.MatchString(path) {
			continue
		}
		data, e := source.Archive.Content(source.Index.Files[i])
		if e != nil {
			invalid++
			continue
		}
		var node Node
		if !utf8.Valid(data) {
			invalid++
			continue
		}
		if e = xml.Unmarshal(data, &node); e != nil {
			invalid++
			continue
		}
		if node.XMLName.Local != "itemInfo" {
			continue
		}
		count++
		add(field(node, "itemKey"), field(node, "itemName"), field(node, "itemDesc"), path, "item")
		var visit func(Node)
		visit = func(n Node) {
			if n.XMLName.Local == "item" {
				add(field(n, "id"), field(n, "name"), field(n, "desc"), path, "reference")
			}
			for _, child := range n.Children {
				visit(child)
			}
		}
		visit(node)
	}
	value, err := json.MarshalIndent(struct {
		Items        map[string]ItemText `json:"items"`
		Files        int                 `json:"files"`
		SkippedFiles int                 `json:"skippedFiles"`
	}{texts, count, invalid}, "", "  ")
	if err != nil {
		panic(err)
	}
	if err = os.WriteFile(os.Args[2], value, 0644); err != nil {
		panic(err)
	}
	fmt.Printf("Korean descriptions=%d XML files=%d skipped=%d\n", len(texts), count, invalid)
	for _, id := range []string{"49778", "4685", "4605"} {
		t := texts[id]
		fmt.Printf("id=%s found=%v source=%s\n", id, t.Description != "", t.SourcePath)
	}
}
