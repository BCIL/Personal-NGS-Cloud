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
		docker stop $(docker ps | grep "dockerui:latest" | awk '{print $1}') > /dev/null 2>&1
		docker rm -f dockerui > /dev/null 2>&1
		if [ "$port_chk" != "" ]; then
			printf "* ERROR: Failed to make port 9000 available. \n Aborted. \n"
			exit 1
		fi
	else
		printf "* Please make sure the port 9000 available. \n Aborted.\n"
		exit 1
	fi
fi

# while true; do
# 	read -r -p "* Please provide DockerUI path: " dockerui_path
# 	if [ ! -d $dockerui_path ]; then
# 		while true; do
# 			printf "[ERROR] - The path(%s) does not exist!" $dockerui_path
# 			read -r -p "* Retype the path(R) or EXIT(E)? [R/E]: " retype_dockerui_path
# 			if [ "$retype_dockerui_path" = "R" ] || [ "$retype_dockerui_path" = "r" ] || [ "$retype_dockerui_path" = "E" ] || [ "$retype_dockerui_path" = "e" ]; then
# 				break
# 			fi
# 		done
# 		if [ "$retype_dockerui_path" = "R" ] || [ "$retype_dockerui_path" = "r" ]; then
# 			continue
# 		elif [ "$retype_dockerui_path" = "E" ] || [ "$retype_dockerui_path" = "e" ]; then
# 			printf '* Aborted.'
# 			exit 1
# 		else
# 			break
# 		fi
# 	else
# 		break
# 	fi
# done

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
BCIL_data_path="/home/$dockerui_uname/BCIL_pipeline_runs"
BCIL_data_path_input="$BCIL_data_path/input"
BCIL_data_path_output="$BCIL_data_path/output"
IsCustomPath=false
if [ -d $BCIL_data_path ] && [ -d $BCIL_data_path_input ] && [ -d $BCIL_data_path_output ]; then
	while true; do
		read -r -p "* Would like to set database path as '$BCIL_data_path': [Y/N]: " user_data_path_answer
		if [ "$user_data_path_answer" = "Y" ] || [ "$user_data_path_answer" = "y" ] || [ "$user_data_path_answer" = "N" ] || [ "$user_data_path_answer" = "n" ]; then
			break
		fi
	done
	if [ "$user_data_path_answer" = "Y" ] || [ "$user_data_path_answer" = "y" ]; then
		user_data_path="/home/BCIL_pipeline_runs"
	else
		while true; do
			printf "Please provide the path of your own data folder that contains input and output folders: \n"
			read -r -p "* > " user_data_path
			if [ $(echo -n $user_data_path | tail -c 1) = '/' ]; then
				user_data_path=$(echo ${user_data_path%?})
			fi
			user_data_path_input="$user_data_path/input"
			user_data_path_output="$user_data_path/output"
			if [ ! -d $user_data_path ]; then
				echo "The provided path does not exist! Please check and enter the correct path."
			elif [ -d $user_data_path_input ] && [ -d $user_data_path_output ]; then
				IsCustomPath=true
				break
			else
				echo "The provided path exists but it contains Invalid contents or Invalid directory structure inside."
			fi
		done
	fi
else
	while true; do
		printf "* [WARN] - The default database path ('%s') doesn't exist. \n* Would you like to provide your database location?" "$BCIL_data_path"
		read -r -p " [Y/N]: " user_data_path_answer
		if [ "$user_data_path_answer" = "Y" ] || [ "$user_data_path_answer" = "y" ] || [ "$user_data_path_answer" = "N" ] || [ "$user_data_path_answer" = "n" ]; then
			break
		fi
	done
	if [ "$user_data_path_answer" = "Y" ] || [ "$user_data_path_answer" = "y" ]; then
		while true; do
			printf "* Please provide the path of your own data folder that contains input and output folders: \n"
			read -r -p "  > " user_data_path
			if [ $(echo -n $user_data_path | tail -c 1) = '/' ]; then
				user_data_path=$(echo ${user_data_path%?})
			fi
			user_data_path_input="$user_data_path/input"
			user_data_path_output="$user_data_path/output"
			if [ ! -d $user_data_path ]; then
				echo "The provided path does not exist! Please check and enter the correct path."
			elif [ -d $user_data_path_input ] && [ -d $user_data_path_output ]; then
				IsCustomPath=true
				break
			else
				printf "* The provided path exists but it contains Invalid contents or Invalid directory structure inside. \n  (Missing the location '$user_data_path_input' and/or '$user_data_path_input')\n\n"
			fi
		done
	else
		printf "*************************************************************************************\n* You did not provide input dataset path, default dataset path will be generated.\n* Database path: %s\n* Please make sure to place your input data manually at the path above to run pipeline instances.\n*************************************************************************************\n\n" "$BCIL_data_path_input"
		mkdir -p $BCIL_data_path $BCIL_data_path_input $BCIL_data_path_output
		no_dataset="true"
	fi
fi

# printf "* Installing git..\n"
# command -v git >/dev/null 2>&1 || { apt-get install -y git > /dev/null 2>&1; }

# printf "*****************************************************************\n** You may need to enter your GitHub account information below **\n*****************************************************************\n"
# printf "* Cloning DockerUI into '/home/dockerui'...\n"
# while true; do
# 	git_login_chk=$( ($(git clone https://github.com/BCIL/DockerUI.git /home/dockerui)) 2>&1)
# 	git_login_chk=$(echo $git_login_chk)
# 	dir_exist_msg="fatal: destination path '/home/dockerui' already exists and is not an empty directory."
# 	if [ "$git_login_chk" == "$dir_exist_msg" ]; then
# 		echo ''
# 		echo "* [WARN] - The path '/home/dockerui' will be replaced as the latest version"
# 		while true; do
# 			read -r -p " Please type [Y/y] to Replace the path or type [N/n] to Keep the current version: " dockerui_path_replace
# 			if [ "$dockerui_path_replace" = "Y" ] || [ "$dockerui_path_replace" = "y" ] || [ "$dockerui_path_replace" = "N" ] || [ "$dockerui_path_replace" = "n" ]; then
# 				break
# 			fi
# 		done
# 		if [ "$dockerui_path_replace" = "Y" ] || [ "$dockerui_path_replace" = "y" ]; then
# 			rm -rf /home/dockerui
# 			continue
# 		else
# 			break
# 		fi
# 	fi
# 	IFS=' ' read -ra arr <<< "$git_login_chk"
# 	stdout_chk=$(echo ${arr[3]})
# 	if [ "$stdout_chk" == "" ]; then
# 		break
# 	else
# 		printf "\n* [ERROR] - Login Failed!, Please check your ID or password!\n\n"
# 	fi
# done
echo ''
printf "** Installing essential components.. 0%%"
sudo bash -c 'apt-get install -y install build-essential libssl-dev libcurl4-gnutls-dev libexpat1-dev gettext unzip' > /dev/null 2>&1
printf " .. 10%%"
command -v software-properties-common >/dev/null 2>&1 || { apt-get install -y software-properties-common > /dev/null 2>&1; }
printf " .. 20%%"
command -v wget >/dev/null 2>&1 || { apt-get install -y wget > /dev/null 2>&1; }
sudo bash -c 'apt-get install -y python-software-properties' > /dev/null 2>&1
printf " .. 30%%"
sudo bash -c 'add-apt-repository -y ppa:chris-lea/node.js' > /dev/null 2>&1 
printf " .. 40%%"
sudo bash -c "sudo sed -i -e 's/us.archive.ubuntu.com/archive.ubuntu.com/g' /etc/apt/sources.list" > /dev/null 2>&1
command -v curl >/dev/null 2>&1 || { apt-get install -y curl > /dev/null 2>&1; }
printf " .. 50%%"
#sudo bash -c 'apt-get update' > /dev/null 2>&1 
sudo bash -c "curl -sL https://deb.nodesource.com/setup | sudo bash -" > /dev/null 2>&1
printf " .. 70%%"
command -v nodejs >/dev/null 2>&1 || { apt-get install -y nodejs > /dev/null 2>&1; }
command -v node >/dev/null 2>&1 || { apt-get install -y node > /dev/null 2>&1; }
command -v npm >/dev/null 2>&1 || { apt-get install -y npm > /dev/null 2>&1; }
printf " .. 90%%"
command -v grunt >/dev/null 2>&1 || { npm install -g grunt-cli > /dev/null 2>&1; }
printf " .. 100%%, Done!\n"

# printf "****************************************************\n** Please provide your Docker account information **\n****************************************************\n"
# while true; do
# 	docker_ver=$(echo $(docker --version))
# 	IFS=',' read -ra arr <<< "$docker_ver"
# 	IFS=' ' read -ra arr2 <<< "$docker_ver"
# 	IFS='.' read -ra main_ver <<< "$docker_ver"
# 	main_ver=$(echo ${main_ver[1]})
#     if [[ "$main_ver" -lt 9 ]]; then
#             chk_email='true'
#     fi

# 	echo "-----------------------------------------"
# 	read -r -p " * Docker ID: " user_docker_id
# 	read -s -p " * Password: " user_docker_pw
# 	printf "\n"
# 	if [ "$chk_email" == 'true' ]; then
# 		read -r -p " * Email: " user_docker_email
# 	fi
# 	echo "-----------------------------------------"
# 	if [ "$chk_email" == 'true' ]; then
# 		docker_login_stdout=$( ($(docker login -u $user_docker_id -p $user_docker_pw -e $user_docker_email)) 2>&1)
# 	else
# 		docker_login_stdout=$( ($(docker login -u $user_docker_id -p $user_docker_pw)) 2>&1)
# 	fi
# 	if [[ "$docker_login_stdout" == *"Error"* ]] || [[ "$docker_login_stdout" == *"error"* ]]; then 
# 		echo "* [ERROR] - Login Failed!, Please check your Docker ID or password!"
# 	else
# 		echo "* Login successfully! ($user_docker_id)"
# 		break
# 	fi
# done

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

echo "** Pulling ChIP-Seq pipeline"
sudo bash -c "docker pull bcil/pipelines:ChIPsequser_paired_latest" > /dev/null
#sudo bash -c "docker pull bcil/pipelines:ChIPsequser_latest"
echo "** Pulling RNA-Seq pipelines"
#sudo bash -c "docker pull bcil/pipelines:RNAsequser_tophat1_latest"
sudo bash -c "docker pull bcil/pipelines:RNAsequser_tophat2_latest" > /dev/null

echo "** Removing old dockerui instances..."
docker stop $(docker ps | grep "_dui_" | awk '{print $1}') > /dev/null 2>&1
docker rm $(docker ps -a | grep "_dui_" | awk '{print $1}') > /dev/null 2>&1
docker rmi -f $(docker images | grep "_dui_" | awk '{print $3}') > /dev/null 2>&1
echo ""
echo "** IP Address: $dockerui_ip"
echo ""

echo "** Initializing ChIP-Seq pipeline instances.."
pipeline_id=$(docker run -d bcil/pipelines:ChIPsequser_paired_latest /bin/bash) > /dev/null 2>&1
dui_chk=$(docker ps -a | grep _dui_paired)
if [ "$dui_chk" != "" ]; then
	docker rm -f $(docker ps -a | grep _dui_paired | awk '{print $1}') > /dev/null 2>&1
fi
printf "***************** ChIP-Seq tool options ******************\n* Mate Inner Distance: 200\n* p_value='0.01\n* gsize='3000000000\n* mfold='15\n***************************************************\n\n"
for i in $ChIP_Seq_inst_list
do
	image_name="bcil/pipelines:ChIP_Seq_dui_paired_$(echo $i)"
	sudo bash -c "docker commit $(echo $pipeline_id) $(echo $image_name)" > /dev/null 2>&1
	if [ "$IsCustomPath" = true ]; then
		sudo bash -c "docker run --name ChIPseq_dockerui -v $(echo $user_data_path):/home/data -d -p $(echo $dockerui_ip):$(echo $i):8090 --env insert_size='200' --env p_value='0.01' --env gsize='3000000000' --env mfold='15' $(echo $image_name) bash /home/init.sh" > /dev/null 2>&1
	else
		sudo bash -c "docker run --name ChIPseq_dockerui -v $(echo $BCIL_data_path):/home/data -d -p $(echo $dockerui_ip):$(echo $i):8090 --env insert_size='200' --env p_value='0.01' --env gsize='3000000000' --env mfold='15' $(echo $image_name) bash /home/init.sh" > /dev/null 2>&1
	fi
done

docker stop $pipeline_id > /dev/null 2>&1
docker stop $(docker ps | grep "_dui_paired" | awk '{print $1}') > /dev/null 2>&1


echo "** Initializing RNA-Seq pipeline instances.."
dui_chk=$(docker ps -a | grep _dui_MateInnerDistance_)
if [ "$dui_chk" != "" ]; then
	docker rm -f $(docker ps -a | grep _dui_MateInnerDistance_ | awk '{print $1}') > /dev/null 2>&1
fi
printf "***************** RNA-Seq tool options ******************\n* Mate Inner Distance: $RNA_Seq_insert_size\n* Anchor Length: 8\n* Minimum length of read segments: 25\n***************************************************\n\n"
if "$IsCustomPath"; then
	pipeline_id=$(docker run -v $(echo $user_data_path):/home/data -ti -d bcil/pipelines:RNAsequser_tophat2_latest /bin/bash) > /dev/null 2>&1
else	
	pipeline_id=$(docker run -v $(echo $BCIL_data_path):/home/data -ti -d bcil/pipelines:RNAsequser_tophat2_latest /bin/bash) > /dev/null 2>&1
fi

for j in $RNA_Seq_insert_size
do
	image_name="bcil/pipelines:RNA_Seq_tp2_dui_MateInnerDistance_$(echo $j)"
	sudo bash -c "docker commit $(echo $pipeline_id) $(echo $image_name)" > /dev/null 2>&1
	if "$IsCustomPath"; then
		sudo bash -c "docker run --name RNAseq_inner_dist_$(echo $j) -v $(echo $user_data_path):/home/data -d -p $(echo $dockerui_ip):6$(echo $j):8090 --env mate_std_dev=$(echo $j) --env anchor_length='8' --env segment_length='25' $(echo $image_name) bash /home/init.sh" > /dev/null 2>&1
	else
		sudo bash -c "docker run --name RNAseq_inner_dist_$(echo $j) -v $(echo $BCIL_data_path):/home/data -d -p $(echo $dockerui_ip):6$(echo $j):8090 --env mate_std_dev=$(echo $j) --env anchor_length='8' --env segment_length='25' $(echo $image_name) bash /home/init.sh" > /dev/null 2>&1
	fi
done
docker stop $pipeline_id > /dev/null 2>&1
docker stop $(docker ps | grep "_dui_MateInnerDistance_" | awk '{print $1}') > /dev/null 2>&1
printf '** Instances are generated.\n*********************************************\n'
docker ps -a | grep _dui_ | awk '{print $2}'
printf '*********************************************\n\n'

printf "** Samba configuration setting.."
if [ -f "/etc/samba/smb.conf" ]; then
	chk_dockerui_installed=$(cat /etc/samba/smb.conf | tail -1)
	if [ "$chk_dockerui_installed" = "#dockerui_installed" ]; then
		printf " - checked!\n\n"
	else
		fn=${BCIL_data_path##*/} 
		setting_val="\n[$fn]\npath = $BCIL_data_path\navailable = yes\nvalid users = $dockerui_uname\nread only = no\nbrowsable = yes\npublic = yes\nwritable = yes\n#dockerui_installed"
		echo -e $setting_val >> /etc/samba/smb.conf
		printf " - done!\n\n"
		sudo service smbd restart
	fi
else
	printf "\n[ERROR] - Cannot find '/etc/samba/smb.conf'. Please check if samba installed.\n Aborted.\n\n"
	exit 1
fi


# for i in 1 2
# do
# 	if [ "$IsCustomPath" = true ]; then
# 		pipeline_id=$(docker run -v $(echo $user_data_path):/home/data -ti -d bcil/pipelines:RNAsequser_tophat$(echo $i)_latest /bin/bash) > /dev/null 2>&1
# 	else	
# 		pipeline_id=$(docker run -v $(echo $BCIL_data_path):/home/data -ti -d bcil/pipelines:RNAsequser_tophat$(echo $i)_latest /bin/bash) > /dev/null 2>&1
# 	fi
# 	for j in 1 2 3
# 	do
# 		sudo bash -c "docker commit $(echo $pipeline_id) bcil/pipelines:RNAsequser_dockerui_tophat$(echo $i)_$(echo $j)" > /dev/null 2>&1
# 		if [ "$IsCustomPath" = true ]; then
# 			sudo bash -c "docker run --name RNAseq_dockerui_Tophat$(echo $i)_$(echo $j) -v $(echo $user_data_path):/home/data -d -p $(echo $dockerui_ip):600$(echo $j):8090 bcil/pipelines:RNAsequser_dockerui_tophat$(echo $i)_$(echo $j) sh /home/init.sh" > /dev/null 2>&1
# 		else
# 			sudo bash -c "docker run --name RNAseq_dockerui_Tophat$(echo $i)_$(echo $j) -v $(echo $BCIL_data_path):/home/data -d -p $(echo $dockerui_ip):600$(echo $j):8090 bcil/pipelines:RNAsequser_dockerui_tophat$(echo $i)_$(echo $j) sh /home/init.sh" > /dev/null 2>&1
# 		fi
# 	done
# 	docker stop $pipeline_id > /dev/null 2>&1
# 	docker stop $(docker ps | grep "sequser_dockerui_" | awk '{print $1}') > /dev/null 2>&1
# done

echo "** Initializing DockerUI.."
docker pull baekdookim/dockerui
docker rm -f dockerui > /dev/null 2>&1
docker run --restart=always --privileged -d -p 9000:9000 -v /var/run/docker.sock:/var/run/docker.sock --name dockerui baekdookim/dockerui
#sudo bash -c 'grunt --base /home/DockerUI --gruntfile /home/dockerui/gruntFile.js run' > /dev/null 2>&1

if [ "$no_dataset" = "true" ]; then
	printf "** DockerUI is ready! \n ** Please place all your dataset in %s to run pipelines**\n\n" "$BCIL_data_path_input"
else
	printf "\n***************************************************\n** DockerUI is Ready! ( %s:9000 )\n***************************************************\n\n" "$dockerui_ip"
fi

exit
