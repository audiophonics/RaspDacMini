#!bin/sh
starting_dir=`pwd`
target_distro="$1"
out_dir="$starting_dir"/release
mkdir -p $out_dir/archives
for file in *
do 
    test -f $file/build.sh && cd $file && sh build.sh "$target_distro" && mv release/* $out_dir/archives
    cd "$starting_dir"
done

printf '#!bin/sh
for file in archives/*
do 
	echo $file
	a=`tar -xvf $file | grep .sh`
	sh $a
done
' > $out_dir/install_rdm_"$target_distro".sh


cd $out_dir
tar -cvzhf install_rdm_"$target_distro".tar.gz archives/* install_rdm_"$target_distro".sh




