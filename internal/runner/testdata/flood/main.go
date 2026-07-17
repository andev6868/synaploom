package main

import (
	"bytes"
	"os"
)

func main() {
	chunk := bytes.Repeat([]byte("x"), 4096)
	_, _ = os.Stdout.Write(chunk)
	_, _ = os.Stderr.Write(chunk)
}
