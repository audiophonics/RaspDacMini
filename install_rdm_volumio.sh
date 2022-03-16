#!bin/sh
for file in archives/*
do 
	echo $file
	a=`tar -xvf $file | grep .sh`
	sh $a
done
