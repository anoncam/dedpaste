#compdef dedpaste

_dedpaste() {
  local -a commands
  local -a main_opts
  
  commands=(
    'keys:Manage encryption keys for secure communication'
    'send:Create and send an encrypted paste to friends'
    'get:Retrieve and decrypt a paste by URL or ID'
  )
  
  main_opts=(
    '(-t --temp)'{-t,--temp}'[Create a one-time paste that is deleted after being viewed]'
    '--type[Specify the content type of the paste (e.g., application/json)]:content-type:(text/plain application/json text/html text/markdown application/xml application/javascript text/css)'
    '(-f --file)'{-f,--file}'[Upload a file from the specified path instead of stdin]:file:_files'
    '(-o --output)'{-o,--output}'[Print only the URL (without any additional text)]'
    '(-e --encrypt)'{-e,--encrypt}'[Encrypt the content before uploading (requires key setup)]'
    '(-c --copy)'{-c,--copy}'[Copy the URL to clipboard automatically]'
    '--help[Show help message]'
    '--version[Show version information]'
  )
  
  _arguments -C \
    '1: :->command' \
    '*: :->args' && ret=0
    
  case $state in
    (command)
      _describe -t commands 'dedpaste commands' commands
      _describe -t options 'dedpaste options' main_opts
      ;;
    (args)
      case $line[1] in
        (keys)
          _arguments \
            '--interactive[Use interactive menu-driven mode for key management]' \
            '--list[List all your keys and friends keys with fingerprints]' \
            '--add-friend[Add a friends public key (requires --key-file)]:friend name:' \
            '--key-file[Path to key file for import/export operations]:key file:_files' \
            '--export[Export your public key to share with friends]' \
            '--remove[Remove a friends key from your keyring]:friend name:' \
            '--gen-key[Generate a new RSA key pair for encryption]' \
            '--my-key[Output your public key to the console for sharing]' \
            '--help[Show help message]'
          ;;
        (send)
          _arguments \
            '(-t --temp)'{-t,--temp}'[Create a one-time paste that is deleted after being viewed]' \
            '--type[Specify the content type of the paste (e.g., application/json)]:content-type:(text/plain application/json text/html text/markdown application/xml application/javascript text/css)' \
            '(-f --file)'{-f,--file}'[Upload a file from the specified path instead of stdin]:file:_files' \
            '(-o --output)'{-o,--output}'[Print only the URL (without any additional text)]' \
            '(-e --encrypt)'{-e,--encrypt}'[Encrypt the content before uploading (requires key setup)]' \
            '--for[Encrypt for a specific friend (requires adding their key first)]:friend name:' \
            '--list-friends[List available friends you can encrypt messages for]' \
            '--key-file[Path to public key for encryption (alternative to stored keys)]:key file:_files' \
            '--gen-key[Generate a new key pair for encryption if you dont have one]' \
            '--interactive[Use interactive mode with guided prompts for message creation]' \
            '--debug[Debug mode: show encrypted content without uploading]' \
            '(-c --copy)'{-c,--copy}'[Copy the URL to clipboard automatically]' \
            '--help[Show help message]'
          ;;
        (get)
          _arguments \
            '1:url or ID:' \
            '--key-file[Path to private key for decryption (if not using default key)]:key file:_files' \
            '--help[Show help message]'
          ;;
      esac
      ;;
  esac
}

_dedpaste "$@"