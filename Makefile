BUILD = -DCMAKE_BUILD_TYPE=Debug

build:
	cmake --build

configure:
	cmake -S . -B $(BUILD)

run:
	./build/rt

test:
	ctest --test-dir build --output-on-failure