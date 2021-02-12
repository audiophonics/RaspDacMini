#!/bin/bash

card_id=`aplay -l | grep -Po "(?<=card )[\d](?=: DAC \[I-Sabre Q2M DAC\])"`


if test -z "$card_id"; then
	echo -1
else 
	case $1 in
	"")
		echo $card_id
	;;
	get_input)
		echo `amixer sget -c $card_id 'I2S/SPDIF Select' | grep Item0: | awk '{print $2}' `
	;;
	toggle_input)
		if ! [[ $card_id -eq -1 ]]; then
			if [[ `amixer sget -c $card_id  'I2S/SPDIF Select' | grep Item0: | awk '{print $2}' ` == *I2S* ]]
			then amixer sset -c $card_id  'I2S/SPDIF Select' SPDIF
			else amixer sset -c $card_id  'I2S/SPDIF Select' I2S
			fi
		fi
	;;
	esac
fi