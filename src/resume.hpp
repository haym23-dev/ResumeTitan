#pragma once

#include <chrono>
#include <string>

struct Location {
  std::string address;
  uint8_t postalCode;
  std::string city;
  std::string region;
};

struct Basics {
  std::string name;
  std::string label;
  std::string image;
  std::string email;
  uint16_t phone;
  std::string url;
  std::string summary;
  Location location;
};

struct Work {
  std::string name;
  Location location;
  std::string description;
  std::string position;
  std::string url;
  std::chrono::year_month_day startDate;
  std::chrono::year_month_day endDate;
  std::string summary;
  std::vector<std::string> highlights;
};

struct Resume {
  int id;
  Basics basics;
  std::vector<Work> work;
};
