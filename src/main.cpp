#include "api_handler.hpp"

#include <httplib.h>

#include <cstdlib>
#include <fstream>
#include <sstream>
#include <iostream>
#include <string>
#include <string_view>
#include <stdexcept>
#include <print>

std::string getEnv(std::string_view var_name) {
  const char* var = std::getenv(var_name.data());

  if (!var) {
    throw std::runtime_error(std::format("Missing critical env variable: {}", var_name));
  }

  return std::string(var);
}

/**
 * readFile - For handling 404 page
 */
static std::string readFile(const std::string& path) {
  std::ifstream in(path, std::ios::binary);
  if (!in) {
    throw std::runtime_error(std::format("Cannot open {}", path));
  }

  std::ostringstream ss;
  ss << in.rdbuf();
  return ss.str();
}

int main() {
  try {
    // Load env variables
    std::string host = getEnv("HOST");
    std::string port = getEnv("PORT");

    httplib::Server srv;

    srv.Get("/api/health", apiHandler::getHealth);
    srv.Get("/api/user", apiHandler::getUser);

    srv.set_mount_point("/", "./public");

    // Set 404 page
    const std::string notFoundPage = readFile("./public/404.html");
    srv.set_error_handler([notFoundPage](const httplib::Request& req, httplib::Response& res) {
      // Only for page requests, leave API errors untouched
      if (res.status == 404 && !req.path.starts_with("/api/")) {
        res.set_content(notFoundPage, "text/html; charset=utf-8");
      }
    });

    std::cout << std::format("Server listening on {}:{}", host, port) << std::endl;

    srv.listen(host.c_str(), std::stoi(port));
  } catch (const std::exception& e) {
    std::cerr << "Fatal error: " << e.what() << "\n";
    return EXIT_FAILURE;
  }

  return EXIT_SUCCESS;
}
