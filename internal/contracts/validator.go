package contracts

import (
	"encoding/json"
	"fmt"

	"github.com/dlclark/regexp2"
	"github.com/santhosh-tekuri/jsonschema/v6"
)

type schemaResource struct {
	URL  string
	Data []byte
}

type Validator struct {
	schemas map[string]*jsonschema.Schema
}

type ecmaRegexp regexp2.Regexp

func (re *ecmaRegexp) MatchString(value string) bool {
	matched, err := (*regexp2.Regexp)(re).MatchString(value)
	return err == nil && matched
}
func (re *ecmaRegexp) String() string { return (*regexp2.Regexp)(re).String() }
func compileECMA(pattern string) (jsonschema.Regexp, error) {
	re, err := regexp2.Compile(pattern, regexp2.ECMAScript)
	if err != nil {
		return nil, err
	}
	return (*ecmaRegexp)(re), nil
}

func NewValidator() *Validator {
	compiler := jsonschema.NewCompiler()
	compiler.UseRegexpEngine(compileECMA)
	for _, resource := range schemaFiles {
		var document any
		if err := json.Unmarshal(resource.Data, &document); err != nil {
			panic(err)
		}
		if err := compiler.AddResource(resource.URL, document); err != nil {
			panic(err)
		}
	}
	compiled := make(map[string]*jsonschema.Schema, len(schemaFiles))
	for name, resource := range schemaFiles {
		schema, err := compiler.Compile(resource.URL)
		if err != nil {
			panic(err)
		}
		compiled[name] = schema
	}
	return &Validator{schemas: compiled}
}

func (v *Validator) Validate(schemaName string, value any) error {
	schema, ok := v.schemas[schemaName]
	if !ok {
		return fmt.Errorf("unknown schema %q", schemaName)
	}
	return schema.Validate(value)
}
