package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Host string
	Port string
	// SessionSecret string
}

func Load() (Config, error) {
	var problems []string

	host := getEnvOrDefault("HOST", "0.0.0.0")
	port := getEnvOrDefault("PORT", "8080")

	trimmedPort := strings.TrimSpace(port)
	n, err := strconv.Atoi(strings.TrimSpace(trimmedPort))
	if err != nil || n < 1 || n > 65535 {
		problems = append(problems, fmt.Sprintf("variable PORT must be an integer between 1 and 65535, got %q", port))
	} else {
		port = trimmedPort
	}

	// sessionSecret, found := os.LookupEnv("SESSION_SECRET")
	// if secret := strings.TrimSpace(sessionSecret); secret == "" && !found {
	// 	problems = append(problems, "SESSION_SECRET must be set and non-empty")
	// } else {
	// 	sessionSecret = secret
	// }

	if len(problems) > 0 {
		return Config{}, fmt.Errorf("invalid configuration:\n - %s", strings.Join(problems, "\n - "))
	}

	return Config{
		Host: host,
		Port: port,
		// SessionSecret: sessionSecret,
	}, nil
}

// Get environment variable, or return default fallback string.
// Used for optional env variables
func getEnvOrDefault(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok && strings.TrimSpace(val) != "" {
		return val
	}

	return fallback
}
