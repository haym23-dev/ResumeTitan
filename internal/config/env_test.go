package config_test

import (
	"resumetitan/internal/config"
	"testing"
)

type Test struct {
	name    string
	env     map[string]string
	want    config.Config
	wantErr bool
}

func TestLoad(t *testing.T) {
	tests := []Test{
		{
			name: "valid custom values",
			env: map[string]string{
				"HOST": "0.0.0.0",
				"PORT": "8080",
			},
			want: config.Config{
				Host: "0.0.0.0",
				Port: "8080",
			},
			wantErr: false,
		},
		{
			name: "invalid port returns error",
			env: map[string]string{
				"PORT": "abcd",
			},
			want:    config.Config{},
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("HOST", "")
			t.Setenv("PORT", "")

			for k, v := range tt.env {
				t.Setenv(k, v)
			}

			got, err := config.Load()

			if (err != nil) != tt.wantErr {
				t.Fatalf("Load() error = %v, wantErr %v", err, tt.wantErr)
			}

			if got != tt.want {
				t.Errorf("Load() = %+v, want %+v", got, tt.want)
			}
		})
	}
}
