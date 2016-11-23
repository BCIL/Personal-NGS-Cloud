# BCIL-DockerUI
> (based on 'UI For Docker')

----
##1-1 Quick run
```
$ docker run -d -p 9000:9000 --privileged -v /var/run/docker.sock:/var/run/docker.sock baekdookim/dockerui`
```


##1-2. Build BCIL-DockerUI
```
$ git clone https://github.com/BCIL/DockerUI.git
$ cd DockerUI
$ grunt run
```


##1-3. Using BCIL-DockerUI script.
### 
```
$ git clone https://github.com/BCIL/DockerUI.git
$ cd DockerUI/script
$ bash install-dockerui.sh
```
----
##2. Connect below address on your browser
###`http://<dockerd host ip>:9000`

----
### Check the [wiki](https://github.com/kevana/uifordocker/wiki) for more info about using UI For Docker

