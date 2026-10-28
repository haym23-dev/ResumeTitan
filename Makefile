# ResumeTitan

BUILD_DIR          ?= build
RELEASE_BUILD_DIR  ?= build-release
BUILD_TYPE         ?= Debug
WARNINGS_AS_ERRORS ?= OFF
CMAKE              ?= cmake
JOBS               ?=
PREFIX_FLAG        ?=

.DEFAULT_GOAL := build

.PHONY: configure build run test release clean rebuild format db-up db-down help

configure: ## Configure the build tree
	$(CMAKE) -S . -B $(BUILD_DIR) -DCMAKE_BUILD_TYPE=$(BUILD_TYPE) -DRT_WARNINGS_AS_ERRORS=$(WARNINGS_AS_ERRORS) $(PREFIX_FLAG)

build: configure ## Compile
	$(CMAKE) --build $(BUILD_DIR) --parallel $(JOBS)

run: build ## Build then run from the repo root
	./$(BUILD_DIR)/rt

test: build ## Run the test suite
	ctest --test-dir $(BUILD_DIR) --output-on-failure

release: ## Release build with warnings treated as errors
	$(MAKE) build BUILD_DIR=$(RELEASE_BUILD_DIR) BUILD_TYPE=Release WARNINGS_AS_ERRORS=ON

clean: ## Remove build directories
	@test -n "$(BUILD_DIR)" && test -n "$(RELEASE_BUILD_DIR)" || { echo "build dir is empty; refusing to clean"; exit 1; }
	rm -rf $(BUILD_DIR) $(RELEASE_BUILD_DIR)

rebuild: clean ## Clean, then rebuild
	$(MAKE) build

format: ## Format C++ sources in place
	find src -type f \( -name '*.cpp' -o -name '*.h' -o -name '*.hpp' \) -print0 | xargs -0 clang-format -i

db-up: ## Start the local MySQL container
	docker compose up -d mysql

db-down: ## Stop the local MySQL container
	docker compose down

help: ## Show this help
	@echo "Usage: make <target> [BUILD_TYPE=Debug|Release] [WARNINGS_AS_ERRORS=ON|OFF] [BUILD_DIR=build]"
	@echo "  Release build with -Werror: make release"
	@echo
	@grep -E '^[a-zA-Z0-9_-]+:.*## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'
