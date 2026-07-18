package activity

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"unicode"
)

type expression interface {
	evaluate(map[string]float64) (float64, error)
}

type numberExpression float64

func (n numberExpression) evaluate(_ map[string]float64) (float64, error) { return float64(n), nil }

type variableExpression string

func (v variableExpression) evaluate(values map[string]float64) (float64, error) {
	name := string(v)
	if name == "pi" {
		return math.Pi, nil
	}
	if name == "e" {
		return math.E, nil
	}
	value, ok := values[name]
	if !ok {
		return 0, fmt.Errorf("unknown variable %q", name)
	}
	return value, nil
}

type unaryExpression struct {
	operator byte
	child    expression
}

func (u unaryExpression) evaluate(values map[string]float64) (float64, error) {
	value, err := u.child.evaluate(values)
	if err != nil {
		return 0, err
	}
	if u.operator == '-' {
		return -value, nil
	}
	return value, nil
}

type binaryExpression struct {
	operator    byte
	left, right expression
}

func (b binaryExpression) evaluate(values map[string]float64) (float64, error) {
	left, err := b.left.evaluate(values)
	if err != nil {
		return 0, err
	}
	right, err := b.right.evaluate(values)
	if err != nil {
		return 0, err
	}
	var result float64
	switch b.operator {
	case '+':
		result = left + right
	case '-':
		result = left - right
	case '*':
		result = left * right
	case '/':
		if math.Abs(right) < 1e-12 {
			return 0, fmt.Errorf("division by zero")
		}
		result = left / right
	case '^':
		result = math.Pow(left, right)
	default:
		return 0, fmt.Errorf("unsupported operator")
	}
	if math.IsNaN(result) || math.IsInf(result, 0) {
		return 0, fmt.Errorf("non-finite result")
	}
	return result, nil
}

type expressionParser struct {
	input    string
	position int
}

func parseExpression(input string) (expression, error) {
	if len(input) == 0 || len(input) > 512 {
		return nil, fmt.Errorf("expression length is invalid")
	}
	parser := &expressionParser{input: input}
	result, err := parser.parseAdditive()
	if err != nil {
		return nil, err
	}
	parser.skipSpace()
	if parser.position != len(parser.input) {
		return nil, fmt.Errorf("unexpected token at %d", parser.position)
	}
	return result, nil
}

func (p *expressionParser) parseAdditive() (expression, error) {
	left, err := p.parseMultiplicative()
	if err != nil {
		return nil, err
	}
	for {
		p.skipSpace()
		operator := p.peek()
		if operator != '+' && operator != '-' {
			return left, nil
		}
		p.position++
		right, err := p.parseMultiplicative()
		if err != nil {
			return nil, err
		}
		left = binaryExpression{operator: operator, left: left, right: right}
	}
}
func (p *expressionParser) parseMultiplicative() (expression, error) {
	left, err := p.parsePower()
	if err != nil {
		return nil, err
	}
	for {
		p.skipSpace()
		operator := p.peek()
		if operator != '*' && operator != '/' {
			return left, nil
		}
		p.position++
		right, err := p.parsePower()
		if err != nil {
			return nil, err
		}
		left = binaryExpression{operator: operator, left: left, right: right}
	}
}
func (p *expressionParser) parsePower() (expression, error) {
	left, err := p.parseUnary()
	if err != nil {
		return nil, err
	}
	p.skipSpace()
	if p.peek() != '^' {
		return left, nil
	}
	p.position++
	right, err := p.parsePower()
	if err != nil {
		return nil, err
	}
	return binaryExpression{operator: '^', left: left, right: right}, nil
}
func (p *expressionParser) parseUnary() (expression, error) {
	p.skipSpace()
	operator := p.peek()
	if operator == '+' || operator == '-' {
		p.position++
		child, err := p.parseUnary()
		if err != nil {
			return nil, err
		}
		return unaryExpression{operator: operator, child: child}, nil
	}
	return p.parsePrimary()
}
func (p *expressionParser) parsePrimary() (expression, error) {
	p.skipSpace()
	if p.peek() == '(' {
		p.position++
		value, err := p.parseAdditive()
		if err != nil {
			return nil, err
		}
		p.skipSpace()
		if p.peek() != ')' {
			return nil, fmt.Errorf("missing closing parenthesis")
		}
		p.position++
		return value, nil
	}
	if p.position >= len(p.input) {
		return nil, fmt.Errorf("expected expression")
	}
	r := rune(p.input[p.position])
	if unicode.IsLetter(r) {
		start := p.position
		for p.position < len(p.input) {
			r = rune(p.input[p.position])
			if !unicode.IsLetter(r) && !unicode.IsDigit(r) && r != '_' {
				break
			}
			p.position++
		}
		name := strings.ToLower(p.input[start:p.position])
		if name != "x" && name != "y" && name != "z" && name != "pi" && name != "e" {
			return nil, fmt.Errorf("identifier %q is not allowed", name)
		}
		return variableExpression(name), nil
	}
	start := p.position
	seenDigit := false
	for p.position < len(p.input) {
		character := p.input[p.position]
		if character >= '0' && character <= '9' {
			seenDigit = true
			p.position++
			continue
		}
		if character == '.' {
			p.position++
			continue
		}
		if character == 'e' || character == 'E' {
			p.position++
			if p.position < len(p.input) && (p.input[p.position] == '+' || p.input[p.position] == '-') {
				p.position++
			}
			continue
		}
		break
	}
	if !seenDigit {
		return nil, fmt.Errorf("expected number or variable")
	}
	value, err := strconv.ParseFloat(p.input[start:p.position], 64)
	if err != nil {
		return nil, fmt.Errorf("invalid number")
	}
	return numberExpression(value), nil
}
func (p *expressionParser) skipSpace() {
	for p.position < len(p.input) && unicode.IsSpace(rune(p.input[p.position])) {
		p.position++
	}
}
func (p *expressionParser) peek() byte {
	if p.position >= len(p.input) {
		return 0
	}
	return p.input[p.position]
}

func expressionsEquivalent(left, right expression) bool {
	samples := []float64{-3, -1, -0.5, 0, 0.5, 1, 2, 5}
	compared := 0
	for _, sample := range samples {
		variables := map[string]float64{"x": sample, "y": sample + 1.25, "z": 2*sample - 0.75}
		leftValue, leftErr := left.evaluate(variables)
		rightValue, rightErr := right.evaluate(variables)
		if leftErr != nil || rightErr != nil {
			continue
		}
		compared++
		tolerance := 1e-9 * (1 + math.Max(math.Abs(leftValue), math.Abs(rightValue)))
		if math.Abs(leftValue-rightValue) > tolerance {
			return false
		}
	}
	return compared >= 4
}
