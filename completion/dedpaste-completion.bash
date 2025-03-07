#!/usr/bin/env bash

_dedpaste_completions() {
  local cur prev opts commands
  COMPREPLY=()
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD-1]}"
  commands="keys send get"
  main_opts="-t --temp --type -f --file -o --output -e --encrypt -c --copy --help --version"
  
  # Check if we're completing a command
  if [[ ${COMP_CWORD} -eq 1 ]]; then
    if [[ ${cur} == -* ]]; then
      COMPREPLY=( $(compgen -W "${main_opts}" -- "${cur}") )
      return 0
    else
      COMPREPLY=( $(compgen -W "${commands}" -- "${cur}") )
      return 0
    fi
  fi
  
  # Complete options for specific commands
  case "${COMP_WORDS[1]}" in
    keys)
      local key_opts="--interactive --list --add-friend --key-file --export --remove --gen-key --my-key --help"
      if [[ ${cur} == -* ]]; then
        COMPREPLY=( $(compgen -W "${key_opts}" -- "${cur}") )
      elif [[ ${prev} == "--key-file" ]]; then
        COMPREPLY=( $(compgen -f -- "${cur}") )
      fi
      return 0
      ;;
    send)
      local send_opts="-t --temp --type -f --file -o --output -e --encrypt --for --list-friends --key-file --gen-key --interactive --debug -c --copy --help"
      if [[ ${cur} == -* ]]; then
        COMPREPLY=( $(compgen -W "${send_opts}" -- "${cur}") )
      elif [[ ${prev} == "--key-file" || ${prev} == "-f" || ${prev} == "--file" ]]; then
        COMPREPLY=( $(compgen -f -- "${cur}") )
      elif [[ ${prev} == "--type" ]]; then
        local content_types="text/plain application/json text/html text/markdown application/xml application/javascript text/css"
        COMPREPLY=( $(compgen -W "${content_types}" -- "${cur}") )
      fi
      return 0
      ;;
    get)
      local get_opts="--key-file --help"
      if [[ ${cur} == -* ]]; then
        COMPREPLY=( $(compgen -W "${get_opts}" -- "${cur}") )
      elif [[ ${prev} == "--key-file" ]]; then
        COMPREPLY=( $(compgen -f -- "${cur}") )
      fi
      return 0
      ;;
    *)
      if [[ ${cur} == -* ]]; then
        COMPREPLY=( $(compgen -W "${main_opts}" -- "${cur}") )
      elif [[ ${prev} == "--key-file" || ${prev} == "-f" || ${prev} == "--file" ]]; then
        COMPREPLY=( $(compgen -f -- "${cur}") )
      elif [[ ${prev} == "--type" ]]; then
        local content_types="text/plain application/json text/html text/markdown application/xml application/javascript text/css"
        COMPREPLY=( $(compgen -W "${content_types}" -- "${cur}") )
      fi
      return 0
      ;;
  esac
}

complete -F _dedpaste_completions dedpaste