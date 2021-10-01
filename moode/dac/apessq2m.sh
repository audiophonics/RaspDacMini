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
			then amixer sset -c $card_id  'I2S/SPDIF Select' SPDIF;  curl -m 0.5 localhost:4153/input=SPDIF > /dev/null 2>&1 &
			else amixer sset -c $card_id  'I2S/SPDIF Select' I2S;  curl -m 0.5 localhost:4153/input=I2S > /dev/null 2>&1 &
			fi
		fi
	;;
	get_filter)
		if ! [[ $card_id -eq -1 ]]; then
           echo `amixer sget -c $card_id 'FIR Filter Type' | awk '/Item0:/ {print}' | cut -d : -f 2- | sed -e "s/ '//" -e  "s/'//g"`
		fi
	;;
	next_filter)
		if ! [[ $card_id -eq -1 ]]; then
            current_filter=`amixer sget -c $card_id 'FIR Filter Type' | awk '/Item0:/ {print}' | cut -d : -f 2- | sed -e "s/ '//" -e  "s/'//g"`
            filters=`amixer sget -c $card_id 'FIR Filter Type' | sed -z 's/.*Items://' | sed -z 's/Item0:.*//' | sed "s/' '\+/,/g" | sed "s/'//g" | sed "s/ //"`
            array=($filters) 
            IFS="," read -a array <<< $filters
            index=0
            for i in "${array[@]}"; do
                if [ "$current_filter" = "${array[${#array[@]}-1]}"  ]; then
                    amixer sset -c $card_id 'FIR Filter Type' "${array[0]}" > /dev/null 
					echo "${array[0]}"
                    normalized=$(echo "${array[0]}" | sed "s/ \+/_/g")
                    break
                fi
                if [ "$i" = "$current_filter" ]; then
                    amixer sset -c $card_id 'FIR Filter Type' "${array[$index+1]}"  > /dev/null
					echo "${array[$index+1]}"
                    normalized=$(echo "${array[$index+1]}" | sed "s/ \+/_/g")
                    break
                fi
                ((index++))
                
            done

		fi
	;;
	esac
fi
exit 0


