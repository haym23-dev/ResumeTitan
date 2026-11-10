#include "api_handler.hpp"

namespace apiHandler {
  void getHealth(const httplib::Request&, httplib::Response& res) {
    res.set_content(R"({"ok": true})", "application/json");
  }

  void getUser(const httplib::Request& req, httplib::Response& res) {
    // TODO
    auto q = req.get_param_value("id");
    res.set_content("Query " + q, "text/plain");
  }

  void saveUpdateResume(const httplib::Request& req, httplib::Response& res) {
    Resume resumeCpy;
    auto id = req.get_param_value("id");
  }
} // namespace apiHandler