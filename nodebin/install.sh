#!bin/sh
target_distribution="$1"

echo "Trying to install nodejs for" "$1" "..."

case "$target_distribution" in 
'volumio')
	exit 0
;;
'moode')
	sudo apt update -y
	sudo apt install --no-install-recommends -y nodejs npm
	exit 0
;;
esac 
 
# rsync -a install/ /usr/local/