#!/bin/env bash
################################################
# 	Personal NGS Cloud installation script
# Author: "Baekdoo Kim (baegi7942@gmail.com)"
################################################

printf "\n\t***************************************\n\t**  Personal NGS Cloud setup wizard  **\n\t***************************************\n\n"

if [ "$(uname)" = "Darwin" ]; then
    user_os="MacOS"

elif [ "$(expr substr $(uname -s) 1 5)" = "Linux" ]; then
    user_os="Linux"
else
	printf "** [ERROR] - This script only works on Linux or MacOS environmnet.\n\t     Aborted.\n"
	exit 1
fi

if [ "$(id -u)" != "0" ] && [ "$user_os" = "Linux" ]; then
	printf "* Please get a root permission before running this script.\n  Aborted.\n"
	exit 1
elif [ "$(id -u)" = "0" ] && [ "$user_os" = "MacOs" ]; then
    printf "* Please run this script WITHOUT 'sudo' permission.\n  Aborted.\n"
    exit 1
elif [ "$(id -u)" = "0" ] && [ "$user_os" = "Linux" ]; then
    printf "** Verified root permission - %s\n" "$user_os"    
else
    printf "** OS check - %s" "$user_os"
fi

if [ "$user_os" = "Linux" ]; then
	command -v lsof >/dev/null 2>&1 || { echo >&2 "** Installing lsof.."; apt-get install -y lsof > /dev/null 2>&1; }
	command -v samba >/dev/null 2>&1 || { echo >&2 "** Installing samba.."; apt-get install -y samba > /dev/null 2>&1; }
	command -v docker >/dev/null 2>&1 || { echo >&2 "** Installing Docker.."; wget -qO- https://get.docker.com/ | sh > /dev/null 2>&1; }
else
	command -v docker >/dev/null 2>&1 || { echo >&2 "** Installing Homebrew.."; /usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)" > /dev/null 2>&1; echo >&2 "** Installing Docker.."; brew install docker; }
fi

### check port 9000 and 9090 & stop previous Personal NGS Cloud and FileManager containers
port_chk=$(lsof -i :9000)
if [ "$port_chk" != "" ]; then
	while true; do
		printf "* A network port 9000 is already taken. Would you like to terminate the docker container that takes port 9000?"
		read -r -p "[Y/N]: " close_port_yn
		if [ "$close_port_yn" = "Y" ] || [ "$close_port_yn" = "y" ] || [ "$close_port_yn" = "N" ] || [ "$close_port_yn" = "n" ]; then
			break
		fi
	done
	if [ "$close_port_yn" = "Y" ] || [ "$close_port_yn" = "y" ]; then
		#kill -9 $(lsof -i :9000 | awk -F ' ' '{print $2}' | sed 1d)
		docker stop $(docker ps | grep ":9000" | awk '{print $1}') > /dev/null 2>&1
		docker rm -f DockerUI_main > /dev/null 2>&1
		sleep 5
		port_chk=$(lsof -i :9000)
		if [ "$port_chk" != "" ]; then
			printf "* ERROR: Failed to make port 9000 available.\n The port 9000 is not occupied by Docker. \n Aborted. \n"
			exit 1
		fi
	else
		printf "* Please make sure the port 9000 available. \n Aborted.\n"
		exit 1
	fi
fi

### Remove previous Personal NGS Cloud File Manager
port_chk=$(lsof -i :9090)
if [ "$port_chk" != "" ]; then
	while true; do
		printf "* A network port 9090 is already taken. Would you like to terminate the docker container that takes port 9090?"
		read -r -p "[Y/N]: " close_port_yn
		if [ "$close_port_yn" = "Y" ] || [ "$close_port_yn" = "y" ] || [ "$close_port_yn" = "N" ] || [ "$close_port_yn" = "n" ]; then
			break
		fi
	done
	if [ "$close_port_yn" = "Y" ] || [ "$close_port_yn" = "y" ]; then
		#kill -9 $(lsof -i :9090 | awk -F ' ' '{print $2}' | sed 1d)
		docker stop $(docker ps | grep ":9090" | awk '{print $1}') > /dev/null 2>&1
		port_chk=$(lsof -i :9090)
		docker rm -f DockerUI_sub > /dev/null 2>&1
		if [ "$port_chk" != "" ]; then
			printf "* ERROR: Failed to make port 9090 available.\n The port 9090 is not occupied by Docker. \n Aborted. \n"
			exit 1
		fi
	else
		printf "* Please make sure the port 9090 available. \n Aborted.\n"
		exit 1
	fi
fi

########################################################
## Generate an user account for Samba: dockerui
## This function does not support MacOS
########################################################
if [ "$user_os" = "Linux" ]; then
    user_list=$(cut -d: -f1 /etc/passwd)
    dockerui_path="/home/dockerui"
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
        adduser --quiet --disabled-password --shell /bin/bash --home /home/$dockerui_uname --gecos "User" $dockerui_uname
        echo $dockerui_uname:$dockerui_passwd | chpasswd
        printf "\n*************** New user information **************\n** User: $dockerui_uname\n** Password: $dockerui_passwd\n****************************************************\n\n"
        smbpasswd -a $dockerui_uname -n
    else
        printf "\n** [INFO] - The username 'dockerui' is already exist.\n  You will need to provide the user 'dockerui' confidential when you setup the shared input location (btw Linux and Windows).\n\n"
    fi
fi


#############
#Preselect filemanager root path
#############
if [ "$user_os" = "MacOS" ]; then
	fileManager_root_path="/Users"
else
	fileManager_root_path="/home"
fi

#############
# Deprecated dynamic root path setting for filemanager
############
# while true; do
# 	printf "* Please provide a root path for the File manager. just hit enter if you would like to set the path as default ($fileManager_root_path)\n "
# 	read -r -p "> " user_storage_path
# 	if [ "$user_storage_path" != "" ]; then
# 		if [ "$(ls $user_storage_path 2>/dev/null)" ] && [ "$(ls $user_storage_path | wc -l)" != 0 ]; then
# 			fileManager_root_path="$user_storage_path"
# 			break
# 		else
# 			printf "The path($user_storage_path) does not exist or it is empty!\n\n"
# 			continue
# 		fi
# 	else
# 		break
# 	fi
# done



if [ "$user_os" = "Linux" ]; then
	printf "\n** Installing essential components.. 0%%"
	bash -c 'apt-get install -y install build-essential libssl-dev libcurl4-gnutls-dev libexpat1-dev gettext unzip' > /dev/null 2>&1
	printf " .. 30%%"
	command -v software-properties-common >/dev/null 2>&1 || { apt-get install -y software-properties-common > /dev/null 2>&1; }
	printf " .. 60%%"
	command -v wget >/dev/null 2>&1 || { apt-get install -y wget > /dev/null 2>&1; }
	bash -c 'apt-get install -y python-software-properties' > /dev/null 2>&1
	printf " .. 100%%"
else
	## MacOS
	printf "\n** Installing essential components.."
	for i in 'unzip' 'wget'; do
		command -v $app >/dev/null 2>&1 || { echo >&2 "** Installing $i.."; brew install $i; }
	done
fi

## check Amazon EC2 server
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
## get local IP address
	dockerui_ip=$(wget http://ipinfo.io/ip -qO -)
	if [ "$dockerui_ip" = "" ]; then
		dockerui_ip="127.0.0.1"
	fi
fi
echo ""
echo "** IP Address: $dockerui_ip"
echo ""

echo "** Initializing 'Personal NGS Cloud' and 'File Manager'.. ** "
docker pull bcil/pipelines:Dockerui > /dev/null 2>&1
docker pull bcil/pipelines:Dockerui_filemanager > /dev/null 2>&1
docker rm -f DockerUI_main > /dev/null 2>&1
docker rm -f DockerUI_sub > /dev/null 2>&1

docker run --restart=always --privileged -d -p 9000:9000 -v /var/run/docker.sock:/var/run/docker.sock --name DockerUI_main bcil/pipelines:Dockerui > /dev/null 2>&1

## FileManager will see entire path of user's local disk. (read only)
mount_root_path='/'

## Mount USB storage function of FileManager does not support MacOS 
if [ "$user_os" = "Linux" ]; then
	docker run --restart=always --privileged -d -p 9090:8090 -v /dev/bus/usb/:/dev/bus/usb -v $mount_root_path:/home/root --name DockerUI_sub bcil/pipelines:Dockerui_filemanager bash /home/init.sh $fileManager_root_path > /dev/null 2>&1
else
	docker run --restart=always --privileged -d -p 9090:8090 -v $mount_root_path:/home/root --name DockerUI_sub bcil/pipelines:Dockerui_filemanager bash /home/init.sh $fileManager_root_path > /dev/null 2>&1
fi

docker_sub_id=$(docker ps | grep 'DockerUI_sub' | awk '{print $1}')

ChIPseq_single_image="bcil/pipelines:ChIPseq_dockerui_single"
ChIPseq_paired_image="bcil/pipelines:ChIPseq_dockerui_paired"
RNAseq_paired_image="bcil/pipelines:RNAseq_dockerui_paired"

echo "** Pulling ChIP-Seq (single-end) pipeline.."
bash -c "docker pull $ChIPseq_single_image" > /dev/null
echo "** Pulling ChIP-Seq (paired-end) pipeline.."
bash -c "docker pull $ChIPseq_paired_image" > /dev/null
echo "** Pulling RNA-Seq pipelines.."
bash -c "docker pull $RNAseq_paired_image" > /dev/null

echo "** Removing old Dockerui instances.."
docker stop $(docker ps | grep "_dui_" | awk '{print $1}') > /dev/null 2>&1
docker rm -f $(docker ps -a | grep "_dui_" | awk '{print $1}') > /dev/null 2>&1
docker rmi -f $(docker images | grep "_dui_" | awk '{print $3}') > /dev/null 2>&1


printf "\n************ Required ChIP-Seq pipeline tool options *************\n* Input_path\n* Reference Genome path\n* Mate Inner Distance\n* P-Value cutoff\n* Genome size\n* Band width\n******************************************************************\n\n"

################### ChIP-Seq (single/paired-end) ###################

ChIPseq_types="single paired"
for type in $ChIPseq_types
do
	if [ "$type" = "single" ]; then
		insert_size_value=200
		ChIPseq_image=$ChIPseq_single_image
	else
		insert_size_value=''
		ChIPseq_image=$ChIPseq_paired_image
	fi
	echo "** Initializing ChIP-Seq ($(echo $type)-end) pipeline instances.."
	pipeline_id=$(docker run -d $ChIPseq_image bash /home/wait.sh) > /dev/null 2>&1
	dui_chk=$(docker ps -a | grep _dui_) > /dev/null 2>&1
	if [ "$dui_chk" != "" ]; then
			docker rm -f $(docker ps -a | grep ChIP_Seq_dui_$(echo $type)_end | awk '{print $1}') > /dev/null 2>&1
			docker rm -f $(docker ps -a | grep ChIP_Seq_$(echo $type)-end | awk '{print $1}') > /dev/null 2>&1
	fi

	image_name="bcil/pipelines:ChIP_Seq_dui_$(echo $type)_end"
	bash -c "docker commit $(echo $pipeline_id) $(echo $image_name)" > /dev/null 2>&1
	
	
	bash -c "docker run --privileged --name ChIP_Seq_$(echo $type)-end --volumes-from $(echo $docker_sub_id) -d -p 8090 --env insert_size=$(echo $insert_size_value) --env pvalue='' --env gsize='' --env bwidth='' --env input_path='' --env ref_path='' $(echo $image_name) bash /home/init.sh" > /dev/null 2>&1

	docker stop $pipeline_id > /dev/null 2>&1
	docker rm -f $pipeline_id > /dev/null 2>&1
	docker stop $(docker ps | grep "_dui_" | awk '{print $1}') > /dev/null 2>&1

	printf "\n*********************************************\n* ChIP-Seq ($(echo $type)-end) instance generated.\n*********************************************\n"
done


################### RNA-Seq (paired-end) ###################

echo "** Initializing RNA-Seq (paired-end) pipeline instances.."

pipeline_id=$(docker run -d $RNAseq_paired_image bash /home/wait.sh) > /dev/null 2>&1
dui_chk=$(docker ps -a | grep _dui_) > /dev/null 2>&1
if [ "$dui_chk" != "" ]; then
        docker rm -f $(docker ps -a | grep RNA_Seq_dui_paired_end | awk '{print $1}') > /dev/null 2>&1
		docker rm -f $(docker ps -a | grep RNA_Seq_paired-end | awk '{print $1}') > /dev/null 2>&1
fi

printf "\n************ Required RNA-Seq tool options *************\n* Input_path\n* Reference Genome path\n* Mate Inner Distance\n* Anchor Length\n* Minimum length of read segments\n********************************************************\n\n"


image_name="bcil/pipelines:RNA_Seq_dui_paired_end"
bash -c "docker commit $(echo $pipeline_id) $(echo $image_name)" > /dev/null 2>&1


bash -c "docker run --name RNA_Seq_paired-end --volumes-from $(echo $docker_sub_id) -d -p 8090 --env mate_std_dev='' --env anchor_length='' --env segment_length='' --env input_path='' --env ref_path='' $(echo $image_name) bash /home/init.sh" > /dev/null 2>&1

docker stop $pipeline_id > /dev/null 2>&1
docker rm -f $pipeline_id > /dev/null 2>&1
docker stop $(docker ps | grep "_dui_" | awk '{print $1}') > /dev/null 2>&1


printf '\n*********************************************\n* RNA-Seq (paired-end) instance generated.\n*********************************************\n'

docker ps -a | grep _dui | awk '{print $2}'

if [ "$user_os" = "Linux" ]; then
    printf "\n** Samba configuration in progress.."
    if [ -f "/etc/samba/smb.conf" ]; then
        chk_dockerui_installed=$(cat /etc/samba/smb.conf | tail -1)
        if [ "$chk_dockerui_installed" = "#dockerui_installed" ]; then
            printf " - checked!\n\n"
        else
            fn=${dockerui_path##*/}
            setting_val="\n[$fn]\npath = $dockerui_path\navailable = yes\nvalid users = $dockerui_uname\nread only = no\nbrowsable = yes\npublic = yes\nwritable = yes\n#dockerui_installed"
            echo -e $setting_val >> /etc/samba/smb.conf
            printf " - done!\n\n"
            service smbd restart
        fi
    else
        printf "\n[ERROR] - Cannot find '/etc/samba/smb.conf'. Please check if samba installed.\n Aborted.\n\n"
        exit 1
    fi
fi

printf "\n*********************************************************\n** Personal NGS Cloud is Ready! ( %s:9000 ) **\n*********************************************************\n\n" "$dockerui_ip"

exit
