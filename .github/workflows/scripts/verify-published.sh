#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Script Inputs (Environment Variables) ---
# Note: GitHub Actions automatically makes workflow inputs available as INPUT_*, capitalized.
PACKAGES_INPUT="${INPUT_PACKAGES:-all}" # Default to 'all' if not provided
DRY_RUN="${INPUT_DRY_RUN:-false}"
NEW_VERSION="${NEW_VERSION}" # Needs to be passed explicitly in env block

# --- Input Validation ---
if [[ -z "$NEW_VERSION" ]]; then
  echo "::error::NEW_VERSION environment variable is required."
  exit 1
fi

echo "--- Verification Script Start ---"
echo "Packages Input: $PACKAGES_INPUT"
echo "Dry Run: $DRY_RUN"
echo "Version to Verify: $NEW_VERSION"

# --- Helper Function ---
check_pkg_exists_locally() {
  local raw_pkg_name=$1
  local simple_pkg_name=$(echo "$raw_pkg_name" | sed 's#^@zubridge/##')
  # Check relative to GITHUB_WORKSPACE if set, otherwise current dir
  local base_path="${GITHUB_WORKSPACE:-.}"
  if [[ -f "$base_path/packages/$simple_pkg_name/package.json" ]]; then
    return 0 # Exists
  else
    return 1 # Doesn't exist
  fi
}

# --- Determine Packages to Verify ---
PACKAGES_TO_VERIFY=()
echo "Determining packages to verify..."

if [[ "$PACKAGES_INPUT" == "all" ]]; then
  # Find all @zubridge packages locally
  while IFS= read -r pkg_json; do
    if [[ "$pkg_json" != *"node_modules"* ]]; then
      # Check if jq is available
      if ! command -v jq &> /dev/null; then
          echo "::error::jq command could not be found. Please install jq."
          exit 1
      fi
      PKG_NAME=$(jq -r '.name' "$pkg_json")
      if [[ "$PKG_NAME" == @zubridge/* ]]; then
          PACKAGES_TO_VERIFY+=("$PKG_NAME")
      fi
    fi
  done < <(find "${GITHUB_WORKSPACE:-.}"/packages -name "package.json" -maxdepth 2 -mindepth 2)
  echo "Verifying ALL packages based on local find: ${PACKAGES_TO_VERIFY[*]}"
else
  # Specific or custom list
  if [[ "$PACKAGES_INPUT" == "electron" ]]; then
      PACKAGES_TO_VERIFY=("@zubridge/electron")
  elif [[ "$PACKAGES_INPUT" == "tauri" ]]; then
      PACKAGES_TO_VERIFY=("@zubridge/tauri")
  else
      # Custom list
      IFS=',' read -ra PKG_LIST <<< "$PACKAGES_INPUT"
      for pkg_raw in "${PKG_LIST[@]}"; do
          pkg_raw_trimmed=$(echo "$pkg_raw" | xargs)
          # Ensure it's scoped and exists locally
          if [[ "$pkg_raw_trimmed" == @zubridge/* ]] && check_pkg_exists_locally "$pkg_raw_trimmed"; then
              PACKAGES_TO_VERIFY+=("$pkg_raw_trimmed")
          else
              echo "::warning::Skipping verification for non-existent/non-scoped package: $pkg_raw_trimmed"
          fi
      done
  fi
  echo "Verifying specified packages: ${PACKAGES_TO_VERIFY[*]}"
fi

# Exit if no packages determined for verification
if [[ ${#PACKAGES_TO_VERIFY[@]} -eq 0 ]]; then
  echo "::warning::No valid packages determined for verification based on input '$PACKAGES_INPUT'. Skipping verification."
  exit 0
fi

# --- Dry Run Logic ---
if [[ "$DRY_RUN" == "true" ]]; then
  echo "--- Dry Run Mode --- "
  echo "DRY RUN: Would verify the following packages were published successfully:"
  for pkg in "${PACKAGES_TO_VERIFY[@]}"; do
    echo "  - $pkg@$NEW_VERSION"
  done
  echo "DRY RUN: Would wait 10s for NPM to index the packages"
  echo "DRY RUN: Would check each package exists on NPM with the expected version"
  echo "--- Verification Script End (Dry Run) ---"
  exit 0 # Exit successfully for dry run
fi

# --- Actual Verification Logic ---
echo "--- Actual Verification on NPM --- "
echo "::group::Verifying published packages on NPM"
echo "Waiting 10s for NPM to index the packages..."
sleep 10

verification_failed=false
for pkg in "${PACKAGES_TO_VERIFY[@]}"; do
  echo "Verifying $pkg@$NEW_VERSION..."
  # Check if pnpm is available
  if ! command -v pnpm &> /dev/null; then
      echo "::error::pnpm command could not be found. Please ensure pnpm is installed and in PATH."
      exit 1
  fi
  # Use pnpm view with --json to get structured output, check version property
  # Redirect stderr to /dev/null to suppress pnpm warnings/errors if package not found
  pnpm_output=$(pnpm view "$pkg@$NEW_VERSION" version --json 2>/dev/null)
  pnpm_exit_code=$?

  if [[ $pnpm_exit_code -eq 0 ]] && [[ "$pnpm_output" == "\"$NEW_VERSION\"" ]]; then
    echo "✅ $pkg@$NEW_VERSION verified"
  else
    echo "::error::Package $pkg@$NEW_VERSION not found or version mismatch on NPM (pnpm exit code: $pnpm_exit_code, Output: $pnpm_output)"
    verification_failed=true
    # Decide whether to exit immediately or check all packages
    # exit 1 # Exit immediately on first failure (can be uncommented)
  fi
done

echo "::endgroup::"

if $verification_failed; then
  echo "::error::One or more packages failed verification."
  echo "--- Verification Script End (Failed) ---"
  exit 1
else
  echo "All specified packages verified successfully on NPM."
  echo "--- Verification Script End (Success) ---"
fi
