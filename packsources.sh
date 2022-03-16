#!bin/sh
currentdir=`pwd`
target_path=`basename "$currentdir"`
cd ..
mkdir -p  /tmp/rdmoledsources
tar -cvzf /tmp/rdmoledsources/rdmoledsources.tar.gz $target_path
mv /tmp/rdmoledsources/rdmoledsources.tar.gz $target_path
rm -r /tmp/rdmoledsources/