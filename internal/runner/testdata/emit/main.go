package main

import (
	"fmt"
	"os"
	"time"
)

func main() {
	fmt.Fprint(os.Stdout, "out")
	time.Sleep(20 * time.Millisecond)
	fmt.Fprint(os.Stderr, "err")
}
