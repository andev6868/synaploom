package main

import (
	"encoding/json"
	"fmt"
	"os"

	contracts "github.com/synaploom/synaploom/internal/contracts"
)

type response struct {
	Valid bool `json:"valid"`
}

func main() {
	if len(os.Args) != 3 {
		panic("usage: go-runner <schema> <fixture>")
	}
	data, err := os.ReadFile(os.Args[2])
	if err != nil {
		panic(err)
	}
	var payload any
	if err := json.Unmarshal(data, &payload); err != nil {
		panic(err)
	}
	result := response{Valid: contracts.NewValidator().Validate(os.Args[1], payload) == nil}
	encoded, err := json.Marshal(result)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(encoded))
}
