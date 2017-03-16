#!/bin/bash

# author: "Baekdoo Kim (baegi7942@gmail.com)"

printf "\n**********************************************\n** BioIT Core DockerUI setup wizard \n**********************************************\n\n"

if [ "$(id -u)" != "0" ]; then
	printf "* Please get a root permission before running this script.\n Abored.\n"
	exit 1
else
	echo "** Verified root permission.."
fi

if [ "$(uname)" = "Darwin" ]; then
    user_os="MacOS"
    printf "** [ERROR] - BCIL-dockerui does not work on MacOS.\n\t     Please run this script on Linux environmnet.\n\t     Aborted.\n"
	exit 1
elif [ "$(expr substr $(uname -s) 1 5)" = "Linux" ]; then
    user_os="Linux"
else
	printf "** [ERROR] - This script only works on Linux.\n\t     Please run this script on Linux or MacOS environmnet.\n\t     Aborted.\n"
	exit 1
fi

command -v lsof >/dev/null 2>&1 || { echo >&2 "** Installing lsof.."; apt-get install -y lsof > /dev/null 2>&1; }
command -v samba >/dev/null 2>&1 || { echo >&2 "** Installing samba.."; apt-get install -y samba > /dev/null 2>&1; }

command -v docker >/dev/null 2>&1 || { echo >&2 "** Installing Docker.."; wget -qO- https://get.docker.com/ | sh > /dev/null 2>&1; }

### Remove previous DockerUI
port_chk=$(netstat -lnt | awk '$6 == "LISTEN" && $4 ~ ".9000"')
if [ "$port_chk" != "" ]; then
	while true; do
		printf "* A network port 9000 is already taken. Would you like to terminate the process that takes port 9000?"
		read -r -p "[Y/N]: " close_port_yn
		if [ "$close_port_yn" = "Y" ] || [ "$close_port_yn" = "y" ] || [ "$close_port_yn" = "N" ] || [ "$close_port_yn" = "n" ]; then
			break
		fi
	done
	if [ "$close_port_yn" = "Y" ] || [ "$close_port_yn" = "y" ]; then
		kill -9 $(lsof -i :9000 | awk -F ' ' '{print $2}' | sed 1d)
		port_chk=$(netstat -lnt | awk '$6 == "LISTEN" && $4 ~ ".9000"')
		docker stop $(docker ps | grep "DockerUI_main" | awk '{print $1}') > /dev/null 2>&1
		docker rm -f DockerUI_main > /dev/null 2>&1
		if [ "$port_chk" != "" ]; then
			printf "* ERROR: Failed to make port 9000 available. \n Aborted. \n"
			exit 1
		fi
	else
		printf "* Please make sure the port 9000 available. \n Aborted.\n"
		exit 1
	fi
fi

### Remove previous DockerUI_fileManager
port_chk=$(netstat -lnt | awk '$6 == "LISTEN" && $4 ~ ".9090"')
if [ "$port_chk" != "" ]; then
	while true; do
		printf "* A network port 9090 is already taken. Would you like to terminate the process that takes port 9090?"
		read -r -p "[Y/N]: " close_port_yn
		if [ "$close_port_yn" = "Y" ] || [ "$close_port_yn" = "y" ] || [ "$close_port_yn" = "N" ] || [ "$close_port_yn" = "n" ]; then
			break
		fi
	done
	if [ "$close_port_yn" = "Y" ] || [ "$close_port_yn" = "y" ]; then
		kill -9 $(lsof -i :9090 | awk -F ' ' '{print $2}' | sed 1d)
		port_chk=$(netstat -lnt | awk '$6 == "LISTEN" && $4 ~ ".9090"')
		docker stop $(docker ps | grep "DockerUI_sub" | awk '{print $1}') > /dev/null 2>&1
		docker rm -f DockerUI_sub > /dev/null 2>&1
		if [ "$port_chk" != "" ]; then
			printf "* ERROR: Failed to make port 9090 available. \n Aborted. \n"
			exit 1
		fi
	else
		printf "* Please make sure the port 9090 available. \n Aborted.\n"
		exit 1
	fi
fi

user_list=$(cut -d: -f1 /etc/passwd)
dockerui_uname="dockerui"
dockerui_passwd="dockerui"
dockerui_uname_chk=false
for i in $user_list; do 
	if [ $i = $dockerui_uname ]; then 
		dockerui_uname_chk=true
		break
	fi 
done

if ! $dockerui_uname_chk; then
	sudo adduser --quiet --disabled-password --shell /bin/bash --home /home/$dockerui_uname --gecos "User" $dockerui_uname
	echo $dockerui_uname:$dockerui_passwd | sudo chpasswd
	printf "\n*************** New user information **************\n** User: $dockerui_uname\n** Password: $dockerui_passwd\n****************************************************\n\n"
	sudo smbpasswd -a $dockerui_uname -n
else
	printf "\n* The username 'dockerui' is already exist.\n  You will need to provide the user 'dockerui' confidential when you setup the shared input location (btw Linux and Windows).\n\n"
fi

RNA_Seq_insert_size="100 130 150 170 200"
ChIP_Seq_inst_list="5010 5020"
fileManager_root_path="/home"

printf "\n\t**********************************************************\n"
printf "\t** Please provide your input data path to each pipeline **\n"
printf "\t**********************************************************\n\n"

# while true; do
# 	printf "* Please provide your 'ChIP-Seq (single-end)' pipeline input path: \n"
# 	read -r -p "  > " chipseq_single_input_path
# 	if [ $(echo -n $chipseq_single_input_path | tail -c 1) = '/' ]; then
# 		chipseq_single_input_path=$(echo ${chipseq_single_input_path%?})
# 	fi
	
# 	if [ ! -d $chipseq_single_input_path ]; then
# 		echo "The input path does not exist! Please check and enter the correct path."
# 	else
# 		if (( "$(ls $chipseq_single_input_path 2>/dev/null | wc -l )" > 0 )); then
# 			break
# 		else
# 			printf "[WARN] - The input path is empty!. \n"
# 			while true; do
# 				read -r -p "CONTINUE? [Y/N]" empty_input_yn
# 				if [ "$empty_input_yn" = "Y" ] || [ "$empty_input_yn" = "y" ] || [ "$empty_input_yn" = "N" ] || [ "$empty_input_yn" = "n" ]; then
# 	 				break
# 	 			fi
# 	 		done
#  			if [ "$empty_input_yn" = "Y" ] || [ "$empty_input_yn" = "y" ]; then
#  				break
#  			fi
# 		fi	
# 	fi
# done

# while true; do
# 	printf "* Please provide your 'ChIP-Seq (paired-end)' pipeline input path: \n"
# 	read -r -p "  > " chipseq_paired_input_path
# 	if [ $(echo -n $chipseq_paired_input_path | tail -c 1) = '/' ]; then
# 		chipseq_paired_input_path=$(echo ${chipseq_paired_input_path%?})
# 	fi
	
# 	if [ ! -d $chipseq_paired_input_path ]; then
# 		echo "The input path does not exist! Please check and enter the correct path."
# 	else
# 		if (( "$(ls $chipseq_single_input_pat 2>/dev/null | wc -l )" > 0 )); then
# 			break
# 		else
# 			printf "[WARN] - The input path is empty!. \n"
# 			while true; do
# 				read -r -p "CONTINUE? [Y/N]" empty_input_yn
# 				if [ "$empty_input_yn" = "Y" ] || [ "$empty_input_yn" = "y" ] || [ "$empty_input_yn" = "N" ] || [ "$empty_input_yn" = "n" ]; then
# 	 				break
# 	 			fi
# 	 		done
#  			if [ "$empty_input_yn" = "Y" ] || [ "$empty_input_yn" = "y" ]; then
#  				break
#  			fi
# 		fi	
# 	fi
# done

while true; do
	printf "* Please provide your 'RNA-Seq (paired-end)' pipeline input path: \n"
	read -r -p "  > " rnaseq_paired_input_path
	if [ $(echo -n $rnaseq_paired_input_path | tail -c 1) = '/' ]; then
		rnaseq_paired_input_path=$(echo ${rnaseq_paired_input_path%?})
	fi
	
	if [ ! -d $rnaseq_paired_input_path ]; then
		echo "The input path does not exist! Please check and enter the correct path."
	else
		if (( "$(ls $rnaseq_paired_input_path 2>/dev/null | wc -l )" > 0 )); then
			break
		else
			printf "[WARN] - The input path is empty!. \n"
			while true; do
				read -r -p "CONTINUE? [Y/N]" empty_input_yn
				if [ "$empty_input_yn" = "Y" ] || [ "$empty_input_yn" = "y" ] || [ "$empty_input_yn" = "N" ] || [ "$empty_input_yn" = "n" ]; then
	 				break
	 			fi
	 		done
 			if [ "$empty_input_yn" = "Y" ] || [ "$empty_input_yn" = "y" ]; then
 				break
 			fi
		fi	
	fi
done

printf "\n\t***************************************************************\n"
printf "\t** Please provide Bowtie2 (hg38) index path to each pipeline **\n"
printf "\t***************************************************************\n\n"

while true; do
	printf "* Please provide the path of the Bowtie2 indices: \n"
	read -r -p "  > " bowtie_index_path
	if [ $(echo -n $bowtie_index_path | tail -c 1) = '/' ]; then
		bowtie_index_path=$(echo ${user_data_path%?})
	fi
	
	if [ ! -d $bowtie_index_path ]; then
		echo "The input path does not exist! Please check and enter the correct path."
	else
		if (( "$(ls $bowtie_index_path 2>/dev/null | wc -l )" > 0 )); then
			break
		else
			printf "[WARN] - The input path is empty!. \n"
			while true; do
				read -r -p "CONTINUE? [Y/N]" empty_input_yn
				if [ "$empty_input_yn" = "Y" ] || [ "$empty_input_yn" = "y" ] || [ "$empty_input_yn" = "N" ] || [ "$empty_input_yn" = "n" ]; then
	 				break
	 			fi
	 		done
 			if [ "$empty_input_yn" = "Y" ] || [ "$empty_input_yn" = "y" ]; then
 				printf "[WARN] - Please make sure to provide correct path before runnning pipeline!\n"
 				break
 			fi
		fi	
	fi
done


printf "\n** Installing essential components.. 0%%"
sudo bash -c 'apt-get install -y install build-essential libssl-dev libcurl4-gnutls-dev libexpat1-dev gettext unzip' > /dev/null 2>&1
printf " .. 30%%"
command -v software-properties-common >/dev/null 2>&1 || { apt-get install -y software-properties-common > /dev/null 2>&1; }
printf " .. 60%%"
command -v wget >/dev/null 2>&1 || { apt-get install -y wget > /dev/null 2>&1; }
sudo bash -c 'apt-get install -y python-software-properties' > /dev/null 2>&1
printf " .. 100%%"

# sudo bash -c 'add-apt-repository -y ppa:chris-lea/node.js' > /dev/null 2>&1 
# printf " .. 40%%"
# sudo bash -c "sudo sed -i -e 's/us.archive.ubuntu.com/archive.ubuntu.com/g' /etc/apt/sources.list" > /dev/null 2>&1
# command -v curl >/dev/null 2>&1 || { apt-get install -y curl > /dev/null 2>&1; }
# printf " .. 50%%"
# #sudo bash -c 'apt-get update' > /dev/null 2>&1 
# sudo bash -c "curl -sL https://deb.nodesource.com/setup | sudo bash -" > /dev/null 2>&1
# printf " .. 70%%"
# command -v nodejs >/dev/null 2>&1 || { apt-get install -y nodejs > /dev/null 2>&1; }
# command -v node >/dev/null 2>&1 || { apt-get install -y node > /dev/null 2>&1; }
# command -v npm >/dev/null 2>&1 || { apt-get install -y npm > /dev/null 2>&1; }
# printf " .. 90%%"
# command -v grunt >/dev/null 2>&1 || { npm install -g grunt-cli > /dev/null 2>&1; }
# printf " .. 100%%, Done!\n"


hn=$(curl --max-time 1 http://169.254.169.254/latest/meta-data/public-hostname > /dev/null 2>&1)
dockerui_ip=""
if [ "$hn" != "" ]; then
	IFS='.' read -ra arr <<< "$hn"
	hn_ip=${arr[0]}
	for i in 1 2 3 4; do 
		dockerui_ip+=${hn_ip[$i]};
		if [ "$i" != "4" ]; then
			dockerui_ip+='.'
		fi 
	done
else
	dockerui_ip=$(wget http://ipinfo.io/ip -qO -)
	if [ "$dockerui_ip" = "" ]; then
		dockerui_ip="127.0.0.1"
	fi
fi
echo ""
echo "** IP Address: $dockerui_ip"
echo ""


echo "** Initializing DockerUI and DockerUI file manager ** "
docker pull bcil/pipelines:Dockerui > /dev/null 2>&1
docker pull bcil/pipelines:Dockerui_filemanager > /dev/null 2>&1
docker rm -f DockerUI_main > /dev/null 2>&1
docker rm -f DockerUI_sub > /dev/null 2>&1

docker run --restart=always --privileged -d -p 9000:9000 -v /var/run/docker.sock:/var/run/docker.sock --name DockerUI_main bcil/pipelines:Dockerui > /dev/null 2>&1
docker run --restart=always --privileged -d -p 9090:8090 -v /dev/bus/usb/:/dev/bus/usb -v /:/home/root --name DockerUI_sub bcil/pipelines:Dockerui_filemanager bash /home/init.sh $fileManager_root_path > /dev/null 2>&1

docker_sub_id=$(docker ps | grep 'DockerUI_sub' | awk '{print $1}')

ChIPseq_single_image="bcil/pipelines:ChIPseq_dockerui_single"
ChIPseq_paired_image="bcil/pipelines:ChIPseq_dockerui_paired"
RNAseq_paired_image="bcil/pipelines:RNAseq_dockerui_paired"

# echo "** Pulling ChIP-Seq (single-end) pipeline.."
# sudo bash -c "docker pull $ChIPseq_single_image" > /dev/null
# echo "** Pulling ChIP-Seq (paired-end) pipeline.."
# sudo bash -c "docker pull $ChIPseq_paired_image" > /dev/null

echo "** Pulling RNA-Seq pipelines"
sudo bash -c "docker pull $RNAseq_paired_image" > /dev/null

echo "** Removing old Dockerui instances..."
docker stop $(docker ps | grep "_dui_" | awk '{print $1}') > /dev/null 2>&1
docker rm -f $(docker ps -a | grep "_dui_" | awk '{print $1}') > /dev/null 2>&1
docker rmi -f $(docker images | grep "_dui_" | awk '{print $3}') > /dev/null 2>&1

if [ $(which mysql) ]; then
	mount_mysql="-v /var/run/mysqld/mysqld.sock:/var/run/mysqld/mysqld.sock"
else
	mount_mysql=""
fi

######### Docker running command (SAMPLE)
## docker run --volumes-from b6dfb3a33e5c --env input_path="/home/BCIL_pipeline_runs/input/RNAseq" --env ref_path="/home/BCIL_pipeline_runs/input/hg38" -ti bcil/pipelines:RNAseq_dockerui_paired bash /home/init.sh
##########################################

# printf "***************** ChIP-Seq tool options ******************\n* Mate Inner Distance: 200\n* p_value='0.01\n* gsize='3000000000\n***************************************************\n\n"


################### ChIP-Seq (single-end) ###################

# echo "** Initializing ChIP-Seq (single-end) pipeline instances.."
# pipeline_id=$(docker run -d $ChIPseq_single_image /bin/bash) > /dev/null 2>&1

# for i in $ChIP_Seq_inst_list
# do
# 	docker rm -f ChIPseq_S_dui_$(echo $i) > /dev/null 2>&1
# 	image_name="bcil/pipelines:ChIPseq_dui_single_$(echo $i)"
# 	sudo bash -c "docker commit $(echo $pipeline_id) $(echo $image_name)" > /dev/null 2>&1
# 	sudo bash -c "docker run --privileged --name ChIPseq_S_dui_$(echo $i) $(echo $mount_mysql) --volumes-from $(echo $docker_sub_id) -d -p $(echo $dockerui_ip):$(echo $i):8090 --env insert_size='200' --env p_value='0.01' --env gsize='3000000000' --env input_path=$(echo $chipseq_single_input_path) --env ref_path=$(echo $bowtie_index_path) $(echo $image_name) bash /home/init.sh" > /dev/null 2>&1
# done

# docker stop $pipeline_id > /dev/null 2>&1
# docker rm -f $pipeline_id > /dev/null 2>&1
# docker stop $(docker ps | grep "_dui_single_" | awk '{print $1}') > /dev/null 2>&1



################### ChIP-Seq (paired-end) ###################

# echo "** Initializing ChIP-Seq (paired-end) pipeline instances.."
# pipeline_id=$(docker run -d $ChIPseq_paired_image /bin/bash) > /dev/null 2>&1

# for i in $ChIP_Seq_inst_list
# do
# 	docker rm -f ChIPseq_P_dui_$(echo $i) > /dev/null 2>&1
# 	image_name="bcil/pipelines:ChIPseq_dui_paired_$(echo $i)"
# 	sudo bash -c "docker commit $(echo $pipeline_id) $(echo $image_name)" > /dev/null 2>&1
# 	sudo bash -c "docker run --privileged --name ChIPseq_P_dui_$(echo $i) $(echo $mount_mysql) --volumes-from $(echo $docker_sub_id) -d -p $(echo $dockerui_ip):$(echo $i):8090 --env insert_size='200' --env p_value='0.01' --env gsize='3000000000' --env input_path=$(echo $chipseq_paired_input_path) --env ref_path=$(echo $bowtie_index_path) $(echo $image_name) bash /home/init.sh" > /dev/null 2>&1
# done

# docker stop $pipeline_id > /dev/null 2>&1
# docker rm -f $pipeline_id > /dev/null 2>&1
# docker stop $(docker ps | grep "_dui_paired_" | awk '{print $1}') > /dev/null 2>&1


echo "** Initializing RNA-Seq (paired-end) pipeline instances.."

pipeline_id=$(docker run -d $RNAseq_paired_image /bin/bash) > /dev/null 2>&1
dui_chk=$(docker ps -a | grep _dui_MateInnerDistance_)
if [ "$dui_chk" != "" ]; then
	docker rm -f $(docker ps -a | grep _dui_MateInnerDistance_ | awk '{print $1}') > /dev/null 2>&1
fi

printf "\n***************** RNA-Seq tool options ******************\n* Mate Inner Distance: $RNA_Seq_insert_size\n* Anchor Length: 8\n* Minimum length of read segments: 25\n***************************************************\n\n"

for i in $RNA_Seq_insert_size
do
	docker rm -f RNAseq_P_dui_$(echo $i) > /dev/null 2>&1
	image_name="bcil/pipelines:RNA_Seq_P_dui_MateInnerDistance_$(echo $i)"
	sudo bash -c "docker commit $(echo $pipeline_id) $(echo $image_name)" > /dev/null 2>&1
	sudo bash -c "docker run --privileged --name RNAseq_P_dui_$(echo $i) $(echo $mount_mysql) --volumes-from $(echo $docker_sub_id) -d -p $(echo $dockerui_ip):6$(echo $i):8090 --env mate_std_dev=$(echo $j) --env anchor_length='8' --env segment_length='25' --env input_path=$(echo $rnaseq_paired_input_path) --env ref_path=$(echo $bowtie_index_path) $(echo $image_name) bash /home/init.sh" > /dev/null 2>&1
done

docker stop $pipeline_id > /dev/null 2>&1
docker rm -f $pipeline_id > /dev/null 2>&1
docker stop $(docker ps | grep "RNA_Seq_P_dui_MateInnerDistance_" | awk '{print $1}') > /dev/null 2>&1


printf '** Instances are generated.\n*********************************************\n'
docker ps -a | grep _dui_ | awk '{print $2}'
printf '*********************************************\n\n'

# printf "** Samba configuration setting.."
# if [ -f "/etc/samba/smb.conf" ]; then
# 	chk_dockerui_installed=$(cat /etc/samba/smb.conf | tail -1)
# 	if [ "$chk_dockerui_installed" = "#dockerui_installed" ]; then
# 		printf " - checked!\n\n"
# 	else
# 		fn=${BCIL_data_path##*/} 
# 		setting_val="\n[$fn]\npath = $BCIL_data_path\navailable = yes\nvalid users = $dockerui_uname\nread only = no\nbrowsable = yes\npublic = yes\nwritable = yes\n#dockerui_installed"
# 		echo -e $setting_val >> /etc/samba/smb.conf
# 		printf " - done!\n\n"
# 		sudo service smbd restart
# 	fi
# else
# 	printf "\n[ERROR] - Cannot find '/etc/samba/smb.conf'. Please check if samba installed.\n Aborted.\n\n"
# 	exit 1
# fi

printf "\n***************************************************\n** DockerUI is Ready! ( %s:9000 )\n***************************************************\n\n" "$dockerui_ip"

exit
