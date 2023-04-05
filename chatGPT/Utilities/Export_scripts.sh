#!/bin/bash

file_list="file_list.txt"
output_file="concatenated_scripts.txt"

> "$output_file"

while read -r path; do
  if [[ -d $path ]]; then
    find "$path" -type f -name "*.cs" | while read -r file_path; do
      echo "==== $(basename "$file_path") ====" >> "$output_file"
      cat "$file_path" >> "$output_file"
      echo -e "\n" >> "$output_file"
    done
  elif [[ -f $path ]]; then
    echo "==== $(basename "$path") ====" >> "$output_file"
    cat "$path" >> "$output_file"
    echo -e "\n" >> "$output_file"
  fi
done < "$file_list"

cat "$output_file"
