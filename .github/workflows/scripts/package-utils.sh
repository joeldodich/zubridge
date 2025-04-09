#!/bin/bash

# Function to get package version
get_package_version() {
  local pkg=$1
  local default_pkg=${2:-"core"}

  if [[ -f "packages/$pkg/package.json" ]]; then
    jq -r '.version' "packages/$pkg/package.json"
  else
    # If requested package doesn't exist, use the default package
    echo "::warning::Package $pkg not found, using $default_pkg as reference"
    jq -r '.version' "packages/$default_pkg/package.json"
  fi
}

# Function to get the version based on package selection
get_version_for_selection() {
  local selection=$1

  if [[ "$selection" == "all" ]]; then
    get_package_version "core"
  elif [[ "$selection" == "electron" ]]; then
    get_package_version "electron"
  elif [[ "$selection" == "tauri" ]]; then
    get_package_version "tauri"
  elif [[ "$selection" == "tauri-v1" ]]; then
    get_package_version "tauri-v1"
  else
    # For custom package list, use the first valid package or core as fallback
    local found_valid=false
    IFS=',' read -ra PKG_LIST <<< "$selection"
    for pkg in "${PKG_LIST[@]}"; do
      pkg=$(echo "$pkg" | xargs) # Trim whitespace
      if [[ -f "packages/$pkg/package.json" ]]; then
        get_package_version "$pkg"
        found_valid=true
        break
      fi
    done

    if [[ "$found_valid" != "true" ]]; then
      echo "::warning::No valid packages found in selection, using core as reference"
      get_package_version "core"
    fi
  fi
}
