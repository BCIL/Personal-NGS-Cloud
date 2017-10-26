# Personal-NGS-Cloud
> (Based on 'UI For Docker')

----
##1-1 Quick run
```
$ docker run -d -p 9000:9000 --privileged -v /var/run/docker.sock:/var/run/docker.sock --name DockerUI_main bcil/pipelines:Dockerui
$ docker run -d -p 9090:8090 --privileged -v $HOME:/home/root --name DockerUI_sub bcil/pipelines:Dockerui_filemanager bash /home/init.sh $HOME
```

##1-2. Using Personal-NGS-Cloud script.
###
```
$ git clone https://github.com/BCIL/Personal-NGS-Cloud.git
$ cd Personal-NGS-Cloud/script

$ sudo bash personal_NGS_cloud.sh.  ## for Linux
$ bash personal_NGS_cloud.sh.  	    ## for MacOS
```
----
##2. Connect below address on your browser
###`http://<docker server ip>:9000`

----
### Check the [wiki](https://github.com/kevana/uifordocker/wiki) for more info about using UI For Docker
