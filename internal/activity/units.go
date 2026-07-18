package activity

import (
	"fmt"
	"math"
	"strings"
)

type unitDefinition struct {
	dimension string
	scale     float64
}

var unitRegistry = map[string]unitDefinition{
	"m": {dimension: "length", scale: 1}, "meter": {dimension: "length", scale: 1}, "metre": {dimension: "length", scale: 1},
	"km": {dimension: "length", scale: 1000}, "cm": {dimension: "length", scale: 0.01}, "mm": {dimension: "length", scale: 0.001},
	"kg": {dimension: "mass", scale: 1}, "g": {dimension: "mass", scale: 0.001}, "mg": {dimension: "mass", scale: 0.000001},
	"s": {dimension: "time", scale: 1}, "sec": {dimension: "time", scale: 1}, "ms": {dimension: "time", scale: 0.001},
	"min": {dimension: "time", scale: 60}, "h": {dimension: "time", scale: 3600}, "hr": {dimension: "time", scale: 3600},
	"rad": {dimension: "angle", scale: 1}, "deg": {dimension: "angle", scale: math.Pi / 180}, "°": {dimension: "angle", scale: math.Pi / 180},
	"k": {dimension: "temperature-delta", scale: 1}, "c": {dimension: "temperature-delta", scale: 1}, "°c": {dimension: "temperature-delta", scale: 1},
}

func convertUnit(value float64, from, to string) (float64, error) {
	from = normalizeUnit(from)
	to = normalizeUnit(to)
	fromDefinition, ok := unitRegistry[from]
	if !ok {
		return 0, fmt.Errorf("unknown unit %q", from)
	}
	toDefinition, ok := unitRegistry[to]
	if !ok {
		return 0, fmt.Errorf("unknown unit %q", to)
	}
	if fromDefinition.dimension != toDefinition.dimension {
		return 0, fmt.Errorf("incompatible units %q and %q", from, to)
	}
	return value * fromDefinition.scale / toDefinition.scale, nil
}

func normalizeUnit(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}
