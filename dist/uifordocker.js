/*! uifordocker - v0.11.0 - 2016-11-22
 * https://github.com/kevana/ui-for-docker
 * Copyright (c) 2016 Michael Crosby & Kevan Ahlquist;
 * Licensed MIT
 */
angular.module('uifordocker', [
    'uifordocker.templates',
    'ngRoute',
    'uifordocker.services',
    'uifordocker.filters',
    'masthead',
    'footer',
    'dashboard',
    'container',
    'containers',
    'containersNetwork',
    'images',
    'image',
    'pullImage',
    'startContainer',
    'sidebar',
    'info',
    'builder',
    'containerLogs',
    'containerTop',
    'events',
    'stats',
    'network',
    'networks',
    'volumes'])
    .config(['$routeProvider', '$httpProvider', function ($routeProvider, $httpProvider) {
        'use strict';

        $httpProvider.defaults.xsrfCookieName = 'csrfToken';
        $httpProvider.defaults.xsrfHeaderName = 'X-CSRF-Token';

        $routeProvider.when('/', {
            templateUrl: 'app/components/dashboard/dashboard.html',
            controller: 'DashboardController'
        });
        $routeProvider.when('/containers/', {
            templateUrl: 'app/components/containers/containers.html',
            controller: 'ContainersController'
        });
        $routeProvider.when('/containers/:id/', {
            templateUrl: 'app/components/container/container.html',
            controller: 'ContainerController'
        });
        $routeProvider.when('/containers/:id/logs/', {
            templateUrl: 'app/components/containerLogs/containerlogs.html',
            controller: 'ContainerLogsController'
        });
        $routeProvider.when('/containers/:id/top', {
            templateUrl: 'app/components/containerTop/containerTop.html',
            controller: 'ContainerTopController'
        });
        $routeProvider.when('/containers/:id/stats', {
            templateUrl: 'app/components/stats/stats.html',
            controller: 'StatsController'
        });
        $routeProvider.when('/containers_network', {
            templateUrl: 'app/components/containersNetwork/containersNetwork.html',
            controller: 'ContainersNetworkController'
        });
        $routeProvider.when('/images/', {
            templateUrl: 'app/components/images/images.html',
            controller: 'ImagesController'
        });
        $routeProvider.when('/images/:id*/', {
            templateUrl: 'app/components/image/image.html',
            controller: 'ImageController'
        });
        $routeProvider.when('/info', {templateUrl: 'app/components/info/info.html', controller: 'InfoController'});
        $routeProvider.when('/events', {
            templateUrl: 'app/components/events/events.html',
            controller: 'EventsController'
        });
        $routeProvider.otherwise({redirectTo: '/'});

        // The Docker API likes to return plaintext errors, this catches them and disp
        $httpProvider.interceptors.push(function() {
            return {
                'response': function(response) {
                    if (typeof(response.data) === 'string' &&
                            (response.data.startsWith('Conflict.') || response.data.startsWith('conflict:'))) {
                        $.gritter.add({
                            title: 'Error',
                            text: $('<div>').text(response.data).html(),
                            time: 10000
                        });
                    }
                    var csrfToken = response.headers('X-Csrf-Token');
                    if (csrfToken) {
                        document.cookie = 'csrfToken=' + csrfToken;
                    }
                    return response;
                }
            };
        });
    }])
    // This is your docker url that the api will use to make requests
    // You need to set this to the api endpoint without the port i.e. http://192.168.1.9
    .constant('DOCKER_ENDPOINT', 'dockerapi')
    .constant('DOCKER_PORT', '') // Docker port, leave as an empty string if no port is requred.  If you have a port, prefix it with a ':' i.e. :4243
    .constant('UI_VERSION', 'v0.11.0');

angular.module('builder', [])
    .controller('BuilderController', ['$scope',
        function ($scope) {
            $scope.template = 'app/components/builder/builder.html';
        }]);

    angular.module('container', [])
    .controller('ContainerController', ['$scope', '$routeParams', '$location', 'Container', 'ContainerCommit', 'Image', 'Messages', 'ViewSpinner', '$timeout',
        function ($scope, $routeParams, $location, Container, ContainerCommit, Image, Messages, ViewSpinner, $timeout) {
            $scope.changes = [];
            $scope.editEnv = false;
            $scope.editPorts = false;
            $scope.editBinds = false;
            $scope.newCfg = {
                Env: [],
                Ports: {}
            };

            var update = function () {
                ViewSpinner.spin();
                Container.get({id: $routeParams.id}, function (d) {
                    $scope.container = d;
                    $scope.container.edit = false;
                    $scope.container.newContainerName = d.Name;

                    // fill up env
                    if (d.Config.Env) {
                        $scope.newCfg.Env = d.Config.Env.map(function (entry) {
                            return {name: entry.split('=')[0], value: entry.split('=')[1]};
                        });
                    }

                    // fill up ports
                    $scope.newCfg.Ports = {};
                    angular.forEach(d.Config.ExposedPorts, function(i, port) {
                        if (d.HostConfig.PortBindings && port in d.HostConfig.PortBindings) {
                            $scope.newCfg.Ports[port] = d.HostConfig.PortBindings[port];
                        }
                        else {
                            $scope.newCfg.Ports[port] = [];
                        }
                    });

                    // fill up bindings
                    $scope.newCfg.Binds = [];
                    var defaultBinds = {};
                    angular.forEach(d.Config.Volumes, function(value, vol) {
                        defaultBinds[vol] = { ContPath: vol, HostPath: '', ReadOnly: false, DefaultBind: true };
                    });
                    angular.forEach(d.HostConfig.Binds, function(binding, i) {
                        var mountpoint = binding.split(':')[0];
                        var vol = binding.split(':')[1] || '';
                        var ro = binding.split(':').length > 2 && binding.split(':')[2] === 'ro';
                        var defaultBind = false;
                        if (vol === '') {
                            vol = mountpoint;
                            mountpoint = '';
                        }

                        if (vol in defaultBinds) {
                            delete defaultBinds[vol];
                            defaultBind = true;
                        }
                        $scope.newCfg.Binds.push({ ContPath: vol, HostPath: mountpoint, ReadOnly: ro, DefaultBind: defaultBind });
                    });
                    angular.forEach(defaultBinds, function(bind) {
                        $scope.newCfg.Binds.push(bind);
                    });

                    ViewSpinner.stop();
                }, function (e) {
                    if (e.status === 404) {
                        $('.detail').hide();
                        Messages.error("Not found", "Pipeline not found.");
                    } else {
                        Messages.error("Failure", e.data);
                    }
                    ViewSpinner.stop();
                });

            };

            var display_galaxy_init = function () {
                console.log("galaxy init msg");
                $("#galaxy_server_info").append("<li id='galaxy_init_msg_wrapper'><span id='galaxy_init_msg' style='text-align:center'>Initializing the Galaxy server..<br />Please stand by..</span></li>");
                
                function blinker() {
                    $("#galaxy_init_msg").fadeOut(700);
                    $("#galaxy_init_msg").fadeIn(700);
                }
                var msg_interval = setInterval(blinker,1400);

                setTimeout(function() {
                    clearInterval(msg_interval);
                    $("#galaxy_init_msg_wrapper").remove();
                }, 22000);
            }

            $scope.start = function () {
                ViewSpinner.spin();
                Container.start({
                    id: $scope.container.Id
                }, {}, function (d) {
                    display_galaxy_init();
                    update();
                    Messages.send("Pipeline started", $routeParams.id);
                }, function (e) {
                    update();
                    Messages.error("Failure", "Pipeline failed to start." + e.data);
                });
            };

            $scope.stop = function () {
                var user_confirm = confirm("The pipeline will be stopped!\nContinue?");
                if (user_confirm) {
                    ViewSpinner.spin();
                    Container.stop({id: $routeParams.id}, function (d) {
                        update();
                        Messages.send("Pipeline stopped", $routeParams.id);
                    }, function (e) {
                        update();
                        Messages.error("Failure", "Pipeline failed to stop." + e.data);
                    });
                }
            };

            $scope.kill = function () {
                var user_confirm = confirm("The pipeline will be stopped and discarded data!\nContinue?");
                if (user_confirm) {
                    ViewSpinner.spin();
                    Container.kill({id: $routeParams.id}, function (d) {
                        update();
                        Messages.send("Pipeline killed", $routeParams.id);
                    }, function (e) {
                        update();
                        Messages.error("Failure", "Pipeline failed to die." + e.data);
                    });
                }
            };

            $scope.restartEnv = function () {
                var config = angular.copy($scope.container.Config);

                config.Env = $scope.newCfg.Env.map(function(entry) {
                    return entry.name+"="+entry.value;
                });

                var portBindings = angular.copy($scope.newCfg.Ports);
                angular.forEach(portBindings, function(item, key) {
                    if (item.length === 0) {
                        delete portBindings[key];
                    }
                });


                var binds = [];
                angular.forEach($scope.newCfg.Binds, function(b) {
                    if (b.ContPath !== '') {
                        var bindLine = '';
                        if (b.HostPath !== '') {
                            bindLine = b.HostPath + ':';
                        }
                        bindLine += b.ContPath;
                        if (b.ReadOnly) {
                            bindLine += ':ro';
                        }
                        if (b.HostPath !== '' || !b.DefaultBind) {
                            binds.push(bindLine);
                        }
                    }
                });


                ViewSpinner.spin();
                ContainerCommit.commit({id: $routeParams.id, tag: $scope.container.Config.Image, config: config }, function (d) {
                    if ('Id' in d) {
                        var imageId = d.Id;
                        Image.inspect({id: imageId}, function(imageData) {
                            // Append current host config to image with new port bindings
                            imageData.Config.HostConfig = angular.copy($scope.container.HostConfig);
                            imageData.Config.HostConfig.PortBindings = portBindings;
                            imageData.Config.HostConfig.Binds = binds;
                            if (imageData.Config.HostConfig.NetworkMode === 'host') {
                                imageData.Config.Hostname = '';
                            }

                            Container.create(imageData.Config, function(containerData) {
                                if (!('Id' in containerData)) {
                                    Messages.error("Failure", "Pipeline failed to create.");
                                    return;
                                }
                                // Stop current if running
                                if ($scope.container.State.Running) {
                                    Container.stop({id: $routeParams.id}, function (d) {
                                        Messages.send("Pipeline stopped", $routeParams.id);
                                        // start new
                                        Container.start({
                                            id: containerData.Id
                                        }, function (d) {
                                            $location.url('/containers/' + containerData.Id + '/');
                                            Messages.send("Pipeline started", $routeParams.id);
                                        }, function (e) {
                                            update();
                                            Messages.error("Failure", "Pipeline failed to start." + e.data);
                                        });
                                    }, function (e) {
                                        update();
                                        Messages.error("Failure", "Pipeline failed to stop." + e.data);
                                    });
                                } else {
                                    // start new
                                    Container.start({
                                        id: containerData.Id
                                    }, function (d) {
                                        $location.url('/containers/'+containerData.Id+'/');
                                        Messages.send("Pipeline started", $routeParams.id);
                                    }, function (e) {
                                        update();
                                        Messages.error("Failure", "Pipeline failed to start." + e.data);
                                    });
                                }

                            }, function(e) {
                                update();
                                Messages.error("Failure", "Image failed to get." + e.data);
                            });
                        }, function (e) {
                            update();
                            Messages.error("Failure", "Image failed to get." + e.data);
                        });

                    } else {
                        update();
                        Messages.error("Failure", "Pipeline commit failed.");
                    }


                }, function (e) {
                    update();
                    Messages.error("Failure", "Pipeline failed to commit." + e.data);
                });
            };

            $scope.commit = function () {
                ViewSpinner.spin();
                ContainerCommit.commit({id: $routeParams.id, repo: $scope.container.Config.Image}, function (d) {
                    update();
                    Messages.send("Pipeline commited", $routeParams.id);
                }, function (e) {
                    update();
                    Messages.error("Failure", "Pipeline failed to commit." + e.data);
                });
            };
            $scope.pause = function () {
                ViewSpinner.spin();
                Container.pause({id: $routeParams.id}, function (d) {
                    update();
                    Messages.send("Pipeline paused", $routeParams.id);
                }, function (e) {
                    update();
                    Messages.error("Failure", "Pipeline failed to pause." + e.data);
                });
            };

            $scope.unpause = function () {
                ViewSpinner.spin();
                Container.unpause({id: $routeParams.id}, function (d) {
                    update();
                    Messages.send("Pipeline unpaused", $routeParams.id);
                }, function (e) {
                    update();
                    Messages.error("Failure", "Pipeline failed to unpause." + e.data);
                });
            };

            $scope.remove = function () {
                ViewSpinner.spin();
                Container.remove({id: $routeParams.id}, function (d) {
                    update();
                    $location.path('/containers');
                    Messages.send("Pipeline removed", $routeParams.id);
                }, function (e) {
                    update();
                    Messages.error("Failure", "Pipeline failed to remove." + e.data);
                });
            };

            $scope.restart = function () {
                ViewSpinner.spin();
                Container.restart({id: $routeParams.id}, function (d) {
                    update();
                    Messages.send("Pipeline restarted", $routeParams.id);
                }, function (e) {
                    update();
                    Messages.error("Failure", "Pipeline failed to restart." + e.data);
                });
            };

            $scope.hasContent = function (data) {
                return data !== null && data !== undefined;
            };

            $scope.getChanges = function () {
                ViewSpinner.spin();
                Container.changes({id: $routeParams.id}, function (d) {
                    $scope.changes = d;
                    ViewSpinner.stop();
                });
            };

            $scope.renameContainer = function () {
                // #FIXME fix me later to handle http status to show the correct error message
                Container.rename({id: $routeParams.id, 'name': $scope.container.newContainerName}, function (data) {
                    if (data.name) {
                        $scope.container.Name = data.name;
                        Messages.send("Pipeline renamed", $routeParams.id);
                    } else {
                        $scope.container.newContainerName = $scope.container.Name;
                        Messages.error("Failure", "Pipeline failed to rename.");
                    }
                });
                $scope.container.edit = false;
            };

            $scope.addEntry = function (array, entry) {
                array.push(entry);
            };
            $scope.rmEntry = function (array, entry) {
                var idx = array.indexOf(entry);
                array.splice(idx, 1);
            };

            $scope.toggleEdit = function() {
                $scope.edit = !$scope.edit;
            };

            update();
            $scope.getChanges();
            setTimeout(function(){
                if(!$scope.container.State.Running) {
                    $("#rename_btn").click();
                    $scope.edit = true;
                }
            },500)
        }]);


angular.module('containerLogs', [])
    .controller('ContainerLogsController', ['$scope', '$routeParams', '$location', '$anchorScroll', 'ContainerLogs', 'Container', 'ViewSpinner',
        function ($scope, $routeParams, $location, $anchorScroll, ContainerLogs, Container, ViewSpinner) {
            $scope.stdout = '';
            $scope.stderr = '';
            $scope.showTimestamps = false;
            $scope.tailLines = 2000;

            ViewSpinner.spin();
            Container.get({id: $routeParams.id}, function (d) {
                $scope.container = d;
                ViewSpinner.stop();
            }, function (e) {
                if (e.status === 404) {
                    Messages.error("Not found", "Container not found.");
                } else {
                    Messages.error("Failure", e.data);
                }
                ViewSpinner.stop();
            });

            function getLogs() {
                ViewSpinner.spin();
                ContainerLogs.get($routeParams.id, {
                    stdout: 1,
                    stderr: 0,
                    timestamps: $scope.showTimestamps,
                    tail: $scope.tailLines
                }, function (data, status, headers, config) {
                    // Replace carriage returns with newlines to clean up output
                    data = data.replace(/[\r]/g, '\n');
                    // Strip 8 byte header from each line of output
                    data = data.substring(8);
                    data = data.replace(/\n(.{8})/g, '\n');
                    $scope.stdout = data;
                    ViewSpinner.stop();
                });

                ContainerLogs.get($routeParams.id, {
                    stdout: 0,
                    stderr: 1,
                    timestamps: $scope.showTimestamps,
                    tail: $scope.tailLines
                }, function (data, status, headers, config) {
                    // Replace carriage returns with newlines to clean up output
                    data = data.replace(/[\r]/g, '\n');
                    // Strip 8 byte header from each line of output
                    data = data.substring(8);
                    data = data.replace(/\n(.{8})/g, '\n');
                    $scope.stderr = data;
                    ViewSpinner.stop();
                });
            }

            // initial call
            getLogs();
            var logIntervalId = window.setInterval(getLogs, 5000);

            $scope.$on("$destroy", function () {
                // clearing interval when view changes
                clearInterval(logIntervalId);
            });

            $scope.scrollTo = function (id) {
                $location.hash(id);
                $anchorScroll();
            };

            $scope.toggleTimestamps = function () {
                getLogs();
            };

            $scope.toggleTail = function () {
                getLogs();
            };
        }]);

angular.module('containerTop', [])
    .controller('ContainerTopController', ['$scope', '$routeParams', 'ContainerTop', 'Container', 'ViewSpinner', function ($scope, $routeParams, ContainerTop, Container, ViewSpinner) {
        $scope.ps_args = '';

        /**
         * Get container processes
         */
        $scope.getTop = function () {
            ViewSpinner.spin();
            ContainerTop.get($routeParams.id, {
                ps_args: $scope.ps_args
            }, function (data) {
                $scope.containerTop = data;
                ViewSpinner.stop();
            });
        };

        Container.get({id: $routeParams.id}, function (d) {
            $scope.containerName = d.Name.substring(1);
        }, function (e) {
            Messages.error("Failure", e.data);
        });

        $scope.getTop();
    }]);
angular.module('containers', [])
    .controller('ContainersController', ['$scope', 'Container', 'Settings', 'Messages', 'ViewSpinner',
        function ($scope, Container, Settings, Messages, ViewSpinner) {
            $scope.sortType = 'Created';
            $scope.sortReverse = true;
            $scope.toggle = false;
            $scope.displayAll = Settings.displayAll;

            $scope.order = function (sortType) {
                $scope.sortReverse = ($scope.sortType === sortType) ? !$scope.sortReverse : false;
                $scope.sortType = sortType;
            };

            var update = function (data) {
                ViewSpinner.spin();
                Container.query(data, function (d) {
                    $scope.containers = d.map(function (item) {
                        return new ContainerViewModel(item);
                    });
                    ViewSpinner.stop();
                });
            };

            var batch = function (items, action, msg) {
                ViewSpinner.spin();
                var counter = 0;
                var complete = function () {
                    counter = counter - 1;
                    if (counter === 0) {
                        ViewSpinner.stop();
                        update({all: Settings.displayAll ? 1 : 0});
                    }
                };
                angular.forEach(items, function (c) {
                    if (c.Checked) {
                        if (action === Container.start) {
                            Container.get({id: c.Id}, function (d) {
                                c = d;
                                counter = counter + 1;
                                action({id: c.Id}, {}, function (d) {
                                    Messages.send("Container " + msg, c.Id);
                                    var index = $scope.containers.indexOf(c);
                                    complete();
                                }, function (e) {
                                    Messages.error("Failure", e.data);
                                    complete();
                                });
                            }, function (e) {
                                if (e.status === 404) {
                                    $('.detail').hide();
                                    Messages.error("Not found", "Container not found.");
                                } else {
                                    Messages.error("Failure", e.data);
                                }
                                complete();
                            });
                        }
                        else {
                            counter = counter + 1;
                            action({id: c.Id}, function (d) {
                                Messages.send("Container " + msg, c.Id);
                                var index = $scope.containers.indexOf(c);
                                complete();
                            }, function (e) {
                                Messages.error("Failure", e.data);
                                complete();
                            });

                        }

                    }
                });
                if (counter === 0) {
                    ViewSpinner.stop();
                }
            };

            $scope.toggleSelectAll = function () {
                angular.forEach($scope.filteredContainers, function (i) {
                    i.Checked = $scope.toggle;
                });
            };

            $scope.toggleGetAll = function () {
                Settings.displayAll = $scope.displayAll;
                update({all: Settings.displayAll ? 1 : 0});
            };

            $scope.startAction = function () {
                batch($scope.containers, Container.start, "Started");
            };

            $scope.stopAction = function () {
                batch($scope.containers, Container.stop, "Stopped");
            };

            $scope.restartAction = function () {
                batch($scope.containers, Container.restart, "Restarted");
            };

            $scope.killAction = function () {
                batch($scope.containers, Container.kill, "Killed");
            };

            $scope.pauseAction = function () {
                batch($scope.containers, Container.pause, "Paused");
            };

            $scope.unpauseAction = function () {
                batch($scope.containers, Container.unpause, "Unpaused");
            };

            $scope.removeAction = function () {
                batch($scope.containers, Container.remove, "Removed");
            };

            update({all: Settings.displayAll ? 1 : 0});
        }]);

angular.module('containersNetwork', ['ngVis'])
    .controller('ContainersNetworkController', ['$scope', '$location', 'Container', 'Messages', 'VisDataSet', function ($scope, $location, Container, Messages, VisDataSet) {

        function ContainerNode(data) {
            this.Id = data.Id;
            // names have the following format: /Name
            this.Name = data.Name.substring(1);
            this.Image = data.Config.Image;
            this.Running = data.State.Running;
            var dataLinks = data.HostConfig.Links;
            if (dataLinks != null) {
                this.Links = {};
                for (var i = 0; i < dataLinks.length; i++) {
                    // links have the following format: /TargetContainerName:/SourceContainerName/LinkAlias
                    var link = dataLinks[i].split(":");
                    var target = link[0].substring(1);
                    var alias = link[1].substring(link[1].lastIndexOf("/") + 1);
                    // only keep shortest alias
                    if (this.Links[target] == null || alias.length < this.Links[target].length) {
                        this.Links[target] = alias;
                    }
                }
            }
            var dataVolumes = data.HostConfig.VolumesFrom;
            //converting array into properties for simpler and faster access
            if (dataVolumes != null) {
                this.VolumesFrom = {};
                for (var j = 0; j < dataVolumes.length; j++) {
                    this.VolumesFrom[dataVolumes[j]] = true;
                }
            }
        }

        function ContainersNetworkData() {
            this.nodes = new VisDataSet();
            this.edges = new VisDataSet();

            this.addContainerNode = function (container) {
                this.nodes.add({
                    id: container.Id,
                    label: container.Name,
                    title: "<ul style=\"list-style-type:none; padding: 0px; margin: 0px\">" +
                    "<li><strong>ID:</strong> " + container.Id + "</li>" +
                    "<li><strong>Image:</strong> " + container.Image + "</li>" +
                    "</ul>",
                    color: (container.Running ? "#8888ff" : "#cccccc")
                });
            };

            this.hasEdge = function (from, to) {
                return this.edges.getIds({
                        filter: function (item) {
                            return item.from === from.Id && item.to === to.Id;
                        }
                    }).length > 0;
            };

            this.addLinkEdgeIfExists = function (from, to) {
                if (from.Links != null && from.Links[to.Name] != null && !this.hasEdge(from, to)) {
                    this.edges.add({
                        from: from.Id,
                        to: to.Id,
                        label: from.Links[to.Name]
                    });
                }
            };

            this.addVolumeEdgeIfExists = function (from, to) {
                if (from.VolumesFrom != null && (from.VolumesFrom[to.Id] != null || from.VolumesFrom[to.Name] != null) && !this.hasEdge(from, to)) {
                    this.edges.add({
                        from: from.Id,
                        to: to.Id,
                        color: {color: '#A0A0A0', highlight: '#A0A0A0', hover: '#848484'}
                    });
                }
            };

            this.removeContainersNodes = function (containersIds) {
                this.nodes.remove(containersIds);
            };
        }

        function ContainersNetwork() {
            this.data = new ContainersNetworkData();
            this.containers = {};
            this.selectedContainersIds = [];
            this.shownContainersIds = [];
            this.events = {
                select: function (event) {
                    $scope.network.selectedContainersIds = event.nodes;
                    $scope.$apply(function () {
                        $scope.query = '';
                    });
                },
                doubleClick: function (event) {
                    $scope.$apply(function () {
                        $location.path('/containers/' + event.nodes[0]);
                    });
                }
            };
            this.options = {
                navigation: true,
                keyboard: true,
                height: '500px', width: '700px',
                nodes: {
                    shape: 'box'
                },
                edges: {
                    style: 'arrow'
                },
                physics: {
                    barnesHut: {
                        springLength: 200
                    }
                }
            };

            this.addContainer = function (data) {
                var container = new ContainerNode(data);
                this.containers[container.Id] = container;
                this.shownContainersIds.push(container.Id);
                this.data.addContainerNode(container);
                for (var otherContainerId in this.containers) {
                    var otherContainer = this.containers[otherContainerId];
                    this.data.addLinkEdgeIfExists(container, otherContainer);
                    this.data.addLinkEdgeIfExists(otherContainer, container);
                    this.data.addVolumeEdgeIfExists(container, otherContainer);
                    this.data.addVolumeEdgeIfExists(otherContainer, container);
                }
            };

            this.selectContainers = function (query) {
                if (this.component != null) {
                    this.selectedContainersIds = this.searchContainers(query);
                    this.component.selectNodes(this.selectedContainersIds);
                }
            };

            this.searchContainers = function (query) {
                if (query.trim() === "") {
                    return [];
                }
                var selectedContainersIds = [];
                for (var i = 0; i < this.shownContainersIds.length; i++) {
                    var container = this.containers[this.shownContainersIds[i]];
                    if (container.Name.indexOf(query) > -1 ||
                        container.Image.indexOf(query) > -1 ||
                        container.Id.indexOf(query) > -1) {
                        selectedContainersIds.push(container.Id);
                    }
                }
                return selectedContainersIds;
            };

            this.hideSelected = function () {
                var i = 0;
                while (i < this.shownContainersIds.length) {
                    if (this.selectedContainersIds.indexOf(this.shownContainersIds[i]) > -1) {
                        this.shownContainersIds.splice(i, 1);
                    } else {
                        i++;
                    }
                }
                this.data.removeContainersNodes(this.selectedContainersIds);
                $scope.query = '';
                this.selectedContainersIds = [];
            };

            this.searchDownstream = function (containerId, downstreamContainersIds) {
                if (downstreamContainersIds.indexOf(containerId) > -1) {
                    return;
                }
                downstreamContainersIds.push(containerId);
                var container = this.containers[containerId];
                if (container.Links == null && container.VolumesFrom == null) {
                    return;
                }
                for (var otherContainerId in this.containers) {
                    var otherContainer = this.containers[otherContainerId];
                    if (container.Links != null && container.Links[otherContainer.Name] != null) {
                        this.searchDownstream(otherContainer.Id, downstreamContainersIds);
                    } else if (container.VolumesFrom != null &&
                        container.VolumesFrom[otherContainer.Id] != null) {
                        this.searchDownstream(otherContainer.Id, downstreamContainersIds);
                    }
                }
            };

            this.updateShownContainers = function (newShownContainersIds) {
                for (var containerId in this.containers) {
                    if (newShownContainersIds.indexOf(containerId) > -1 &&
                        this.shownContainersIds.indexOf(containerId) === -1) {
                        this.data.addContainerNode(this.containers[containerId]);
                    } else if (newShownContainersIds.indexOf(containerId) === -1 &&
                        this.shownContainersIds.indexOf(containerId) > -1) {
                        this.data.removeContainersNodes(containerId);
                    }
                }
                this.shownContainersIds = newShownContainersIds;
            };

            this.showSelectedDownstream = function () {
                var downstreamContainersIds = [];
                for (var i = 0; i < this.selectedContainersIds.length; i++) {
                    this.searchDownstream(this.selectedContainersIds[i], downstreamContainersIds);
                }
                this.updateShownContainers(downstreamContainersIds);
            };

            this.searchUpstream = function (containerId, upstreamContainersIds) {
                if (upstreamContainersIds.indexOf(containerId) > -1) {
                    return;
                }
                upstreamContainersIds.push(containerId);
                var container = this.containers[containerId];
                for (var otherContainerId in this.containers) {
                    var otherContainer = this.containers[otherContainerId];
                    if (otherContainer.Links != null && otherContainer.Links[container.Name] != null) {
                        this.searchUpstream(otherContainer.Id, upstreamContainersIds);
                    } else if (otherContainer.VolumesFrom != null &&
                        otherContainer.VolumesFrom[container.Id] != null) {
                        this.searchUpstream(otherContainer.Id, upstreamContainersIds);
                    }
                }
            };

            this.showSelectedUpstream = function () {
                var upstreamContainersIds = [];
                for (var i = 0; i < this.selectedContainersIds.length; i++) {
                    this.searchUpstream(this.selectedContainersIds[i], upstreamContainersIds);
                }
                this.updateShownContainers(upstreamContainersIds);
            };

            this.showAll = function () {
                for (var containerId in this.containers) {
                    if (this.shownContainersIds.indexOf(containerId) === -1) {
                        this.data.addContainerNode(this.containers[containerId]);
                        this.shownContainersIds.push(containerId);
                    }
                }
            };

        }

        $scope.network = new ContainersNetwork();

        var showFailure = function (event) {
            Messages.error('Failure', e.data);
        };

        var addContainer = function (container) {
            $scope.network.addContainer(container);
        };

        var update = function (data) {
            Container.query(data, function (d) {
                for (var i = 0; i < d.length; i++) {
                    Container.get({id: d[i].Id}, addContainer, showFailure);
                }
            });
        };
        update({all: 0});

        $scope.includeStopped = false;
        $scope.toggleIncludeStopped = function () {
            $scope.network.updateShownContainers([]);
            update({all: $scope.includeStopped ? 1 : 0});
        };

    }]);

angular.module('dashboard', [])
    .controller('DashboardController', ['$scope', 'Container', 'Image', 'Settings', 'LineChart', function ($scope, Container, Image, Settings, LineChart) {
        $scope.predicate = '-Created';
        $scope.containers = [];

        var getStarted = function (data) {
            $scope.totalContainers = data.length;
            LineChart.build('#containers-started-chart', data, function (c) {
                return new Date(c.Created * 1000).toLocaleDateString();
            });
            var s = $scope;
            Image.query({}, function (d) {
                s.totalImages = d.length;
                LineChart.build('#images-created-chart', d, function (c) {
                    return new Date(c.Created * 1000).toLocaleDateString();
                });
            });
        };
        var update = function (data) {
            Container.query(data, function (d) {
                $scope.containers = d.map(function (item) {
                    return new ContainerViewModel(item);
                });
            });
        };
        $scope.toggleGetAll = function () {
            Settings.displayAll = $scope.displayAll;
            update({all: Settings.displayAll ? 1 : 0});
            window.test_scope = $scope;
        };

        $scope.order = function(key) {
            console.log("order key: " + key)
            $scope.sortKey = key;
            $scope.reverse = !$scope.reverse;
        }
        
        $scope.myFilter = function (container) {
            var image_name = container.Image;
            
            if ( image_name.search("_dui_") != -1 ) {
                return true
            }
            else {
                return false
            }
         }

        var opts = {animation: false};
        if (Settings.firstLoad) {
            opts.animation = true;
            Settings.firstLoad = false;
            localStorage.setItem('firstLoad', false);
            $('#masthead').show();

            setTimeout(function () {
                $('#masthead').slideUp('slow');
            }, 5000);
        }

        function valid_pipeline(item){
            var image_name = item.Image;
            if ( image_name.search("_dui_") != -1 ) {
                return true;
            }
            else { return false; }
        }

        Container.query({all: 1}, function (d) {
            var created = 0;
            var running = 0;
            var ghost = 0;
            var stopped = 0;
            window.test_items = [];
            for (var i = 0; i < d.length; i++) {
                var item = d[i];
                var isValid = valid_pipeline(item);
                if (isValid && item.Status === "Ghost") {
                    ghost += 1;
                }
                else if (isValid && item.Status.indexOf('Exit') !== -1) {
                    stopped += 1;
                }
                else if (isValid && item.Status === "" || item.Status === "Created") {
                    //stopped += 1;
                }
                else {
                    if (isValid) {
                        running += 1;
                        $scope.containers.push(new ContainerViewModel(item));
                    }
                }
            }
/*
        Container.query({all: 1}, function (d) {
            var running = 0;
            var ghost = 0;
            var stopped = 0;
            var created = 0;

            for (var i = 0; i < d.length; i++) {
                var item = d[i];

                if (item.Status === "Ghost") {
                    ghost += 1;
                } else if (item.Status === "Created") {
                    created += 1;
                } else if (item.Status.indexOf('Exit') !== -1) {
                    stopped += 1;
                } else {
                    running += 1;
                    $scope.containers.push(new ContainerViewModel(item));
                }
            }
*/
            //getStarted(d);
            window.test_scope_cont = $scope.containers;

            var c = new Chart($('#containers-chart').get(0).getContext("2d"));
            var data = [
                {
                    value: created,
                    color: '#000000',
                    title: 'Created'
                },
                {
                    value: running,
                    color: '#5bb75b',
                    title: 'Running'
                }, // running
                {
                    value: stopped,
                    color: '#C7604C',
                    title: 'Stopped'
                }, // stopped
                {
                    value: ghost,
                    color: '#E2EAE9',
                    title: 'Ghost'
                } // ghost
            ];

            c.Doughnut(data, opts);
            var lgd = $('#chart-legend').get(0);
            legend(lgd, data);
            window.test_container_port = [];
            setTimeout(function() {
                $("#displayAll").click();
            },300);
            setTimeout(function() {
                'use strict';
                $('#occupied_ports').empty();
                for (var i=0;i<$scope.containers.length;i++){
                    if ($scope.containers[i].Status[0] === 'U') {
                        var container = $scope.containers[i];
                        var container_name = container.Image;
                        if (container_name.search("_dui_") != -1) 
                        {
                            test_container_port.push($scope)
                            var image_name = ($scope.containers[i].Names[0]).replace('/','');
                            var port_info = $scope.containers[i].Ports.Public_port;
                            if (typeof(port_info) === 'undefined') {
                                port_info = 'No broadcasting'
                            }
                            $('#occupied_ports').append('<li>'+image_name+' -> <b>'+port_info+'</b></li>')
                        }
                    }
                }
            },600);

            var refresh_interval = 3000//(1000 * 60) * 5;
            /*
            setInterval(function() {
                $('#containers-chart').empty();
                $('#chart-legend').empty();
                //$route.reload();
                $window.location.reload();
            }, refresh_interval);
            */
        });
        $('#containers-started-chart').css('width', '80%');
        $('#images-created-chart').css('width', '80%');
        $('#displayAll_chk').hide();
    }]);


angular.module('events', ['ngOboe'])
    .controller('EventsController', ['Settings', '$scope', 'Oboe', 'Messages', '$timeout', function (Settings, $scope, oboe, Messages, $timeout) {
        $scope.updateEvents = function () {
            $scope.dockerEvents = [];

            // TODO: Clean up URL building
            var url = Settings.url + '/events?';

            if ($scope.model.since) {
                var sinceSecs = Math.floor($scope.model.since.getTime() / 1000);
                url += 'since=' + sinceSecs + '&';
            }
            if ($scope.model.until) {
                var untilSecs = Math.floor($scope.model.until.getTime() / 1000);
                url += 'until=' + untilSecs;
            }

            oboe({
                url: url,
                pattern: '{id status time}'
            })
                .then(function (node) {
                    // finished loading
                    $timeout(function () {
                        $scope.$apply();
                    });
                }, function (error) {
                    // handle errors
                    Messages.error("Failure", error.data);
                }, function (node) {
                    // node received
                    $scope.dockerEvents.push(node);
                });
        };

        // Init
        $scope.model = {};
        $scope.model.since = new Date(Date.now() - 86400000); // 24 hours in the past
        $scope.model.until = new Date();
        $scope.updateEvents();

    }]);
angular.module('footer', [])
    .controller('FooterController', ['$scope', 'Settings', 'Version', function ($scope, Settings, Version) {
        $scope.template = 'app/components/footer/statusbar.html';

        $scope.uiVersion = Settings.uiVersion;
        Version.get({}, function (d) {
            $scope.apiVersion = d.ApiVersion;
        });
    }]);

angular.module('image', [])
    .controller('ImageController', ['$scope', '$q', '$routeParams', '$location', 'Image', 'Container', 'Messages', 'LineChart',
        function ($scope, $q, $routeParams, $location, Image, Container, Messages, LineChart) {
            $scope.history = [];
            $scope.tagInfo = {repo: '', version: '', force: false};
            $scope.id = '';
            $scope.repoTags = [];

            $scope.removeImage = function (id) {
                Image.remove({id: id}, function (d) {
                    d.forEach(function(msg){
                        var key = Object.keys(msg)[0];
                        Messages.send(key, msg[key]);
                    });
                    // If last message key is 'Deleted' then assume the image is gone and send to images page
                    if (d[d.length-1].Deleted) {
                        $location.path('/images');
                    } else {
                        $location.path('/images/' + $scope.id); // Refresh the current page.
                    }
                }, function (e) {
                    $scope.error = e.data;
                    $('#error-message').show();
                });
            };

            $scope.getHistory = function () {
                Image.history({id: $routeParams.id}, function (d) {
                    $scope.history = d;
                });
            };

            $scope.addTag = function () {
                var tag = $scope.tagInfo;
                Image.tag({
                    id: $routeParams.id,
                    repo: tag.repo,
                    tag: tag.version,
                    force: tag.force ? 1 : 0
                }, function (d) {
                    Messages.send("Tag Added", $routeParams.id);
                    $location.path('/images/' + $scope.id);
                }, function (e) {
                    $scope.error = e.data;
                    $('#error-message').show();
                });
            };

            function getContainersFromImage($q, Container, imageId) {
                var defer = $q.defer();

                Container.query({all: 1, notruc: 1}, function (d) {
                    var containers = [];
                    for (var i = 0; i < d.length; i++) {
                        var c = d[i];
                        if (c.ImageID === imageId) {
                            containers.push(new ContainerViewModel(c));
                        }
                    }
                    defer.resolve(containers);
                });

                return defer.promise;
            }

            /**
             * Get RepoTags from the /images/query endpoint instead of /image/json,
             * for backwards compatibility with Docker API versions older than 1.21
             * @param {string} imageId
             */
            function getRepoTags(imageId) {
                Image.query({}, function (d) {
                    d.forEach(function(image) {
                        if (image.Id === imageId && image.RepoTags[0] !== '<none>:<none>') {
                            $scope.RepoTags = image.RepoTags;
                        }
                    });
                });
            }

            Image.get({id: $routeParams.id}, function (d) {
                $scope.image = d;
                $scope.id = d.Id;
                if (d.RepoTags) {
                    $scope.RepoTags = d.RepoTags;
                } else {
                    getRepoTags($scope.id);
                }

                getContainersFromImage($q, Container, $scope.id).then(function (containers) {
                    LineChart.build('#containers-started-chart', containers, function (c) {
                        return new Date(c.Created * 1000).toLocaleDateString();
                    });
                });
            }, function (e) {
                if (e.status === 404) {
                    $('.detail').hide();
                    $scope.error = "Image not found.<br />" + $routeParams.id;
                } else {
                    $scope.error = e.data;
                }
                $('#error-message').show();
            });

            $scope.getHistory();
        }]);

angular.module('images', [])
    .controller('ImagesController', ['$scope', 'Image', 'ViewSpinner', 'Messages',
        function ($scope, Image, ViewSpinner, Messages) {
            $scope.sortType = 'Created';
            $scope.sortReverse = true;
            $scope.toggle = false;

            $scope.order = function(sortType) {
                $scope.sortReverse = ($scope.sortType === sortType) ? !$scope.sortReverse : false;
                $scope.sortType = sortType;
            };

            $scope.showBuilder = function () {
                $('#build-modal').modal('show');
            };

            $scope.removeAction = function () {
                ViewSpinner.spin();
                var counter = 0;
                var complete = function () {
                    counter = counter - 1;
                    if (counter === 0) {
                        ViewSpinner.stop();
                    }
                };
                angular.forEach($scope.images, function (i) {
                    if (i.Checked) {
                        counter = counter + 1;
                        Image.remove({id: i.Id}, function (d) {
                            angular.forEach(d, function (resource) {
                                Messages.send("Image deleted", resource.Deleted);
                            });
                            var index = $scope.images.indexOf(i);
                            $scope.images.splice(index, 1);
                            complete();
                        }, function (e) {
                            Messages.error("Failure", e.data);
                            complete();
                        });
                    }
                });
            };

            $scope.toggleSelectAll = function () {
                angular.forEach($scope.filteredImages, function (i) {
                    i.Checked = $scope.toggle;
                });
            };

            ViewSpinner.spin();
            Image.query({}, function (d) {
                $scope.images = d.map(function (item) {
                    return new ImageViewModel(item);
                });
                ViewSpinner.stop();
            }, function (e) {
                Messages.error("Failure", e.data);
                ViewSpinner.stop();
            });
        }]);

angular.module('info', [])
    .controller('InfoController', ['$scope', 'Info', 'Version', 'Settings',
        function ($scope, Info, Version, Settings) {
            $scope.info = {};
            $scope.docker = {};
            $scope.endpoint = Settings.endpoint;

            Version.get({}, function (d) {
                $scope.docker = d;
            });
            Info.get({}, function (d) {
                $scope.info = d;
            });
        }]);

angular.module('masthead', [])
    .controller('MastheadController', ['$scope', function ($scope) {
        $scope.template = 'app/components/masthead/masthead.html';
    }]);

angular.module('network', []).config(['$routeProvider', function ($routeProvider) {
    $routeProvider.when('/networks/:id/', {
        templateUrl: 'app/components/network/network.html',
        controller: 'NetworkController'
    });
}]).controller('NetworkController', ['$scope', 'Network', 'ViewSpinner', 'Messages', '$routeParams', '$location', 'errorMsgFilter',
    function ($scope, Network, ViewSpinner, Messages, $routeParams, $location, errorMsgFilter) {

        $scope.disconnect = function disconnect(networkId, containerId) {
            ViewSpinner.spin();
            Network.disconnect({id: $routeParams.id}, {Container: containerId}, function (d) {
                ViewSpinner.stop();
                Messages.send("Container disconnected", containerId);
                $location.path('/networks/' + $routeParams.id); // Refresh the current page.
            }, function (e) {
                ViewSpinner.stop();
                Messages.error("Failure", e.data);
            });
        };
        $scope.connect = function connect(networkId, containerId) {
            ViewSpinner.spin();
            Network.connect({id: $routeParams.id}, {Container: containerId}, function (d) {
                ViewSpinner.stop();
                var errmsg = errorMsgFilter(d);
                if (errmsg) {
                    Messages.error('Error', errmsg);
                } else {
                    Messages.send("Container connected", d);
                }
                $location.path('/networks/' + $routeParams.id); // Refresh the current page.
            }, function (e) {
                ViewSpinner.stop();
                Messages.error("Failure", e.data);
            });
        };
        $scope.remove = function remove(networkId) {
            ViewSpinner.spin();
            Network.remove({id: $routeParams.id}, function (d) {
                ViewSpinner.stop();
                Messages.send("Network removed", d);
                $location.path('/networks'); // Go to the networks page
            }, function (e) {
                ViewSpinner.stop();
                Messages.error("Failure", e.data);
            });
        };

        ViewSpinner.spin();
        Network.get({id: $routeParams.id}, function (d) {
            $scope.network = d;
            ViewSpinner.stop();
        }, function (e) {
            Messages.error("Failure", e.data);
            ViewSpinner.stop();
        });
    }]);

angular.module('networks', []).config(['$routeProvider', function ($routeProvider) {
    $routeProvider.when('/networks/', {
        templateUrl: 'app/components/networks/networks.html',
        controller: 'NetworksController'
    });
}]).controller('NetworksController', ['$scope', 'Network', 'ViewSpinner', 'Messages', '$route', 'errorMsgFilter',
    function ($scope, Network, ViewSpinner, Messages, $route, errorMsgFilter) {
        $scope.sortType = 'Name';
        $scope.sortReverse = true;
        $scope.toggle = false;
        $scope.order = function(sortType) {
            $scope.sortReverse = ($scope.sortType === sortType) ? !$scope.sortReverse : false;
            $scope.sortType = sortType;
        };
        $scope.createNetworkConfig = {
            "Name": '',
            "Driver": '',
            "IPAM": {
                "Config": [{
                    "Subnet": '',
                    "IPRange": '',
                    "Gateway": ''
                }]
            }
        };



        $scope.removeAction = function () {
            ViewSpinner.spin();
            var counter = 0;
            var complete = function () {
                counter = counter - 1;
                if (counter === 0) {
                    ViewSpinner.stop();
                }
            };
            angular.forEach($scope.networks, function (network) {
                if (network.Checked) {
                    counter = counter + 1;
                    Network.remove({id: network.Id}, function (d) {
                        Messages.send("Network deleted", network.Id);
                        var index = $scope.networks.indexOf(network);
                        $scope.networks.splice(index, 1);
                        complete();
                    }, function (e) {
                        Messages.error("Failure", e.data);
                        complete();
                    });
                }
            });
        };

        $scope.toggleSelectAll = function () {
            angular.forEach($scope.filteredNetworks, function (i) {
                i.Checked = $scope.toggle;
            });
        };

        $scope.addNetwork = function addNetwork(createNetworkConfig) {
            ViewSpinner.spin();
            Network.create(createNetworkConfig, function (d) {
                if (d.Id) {
                    Messages.send("Network created", d.Id);
                } else {
                    Messages.error('Failure', errorMsgFilter(d));
                }
                ViewSpinner.stop();
                fetchNetworks();
            }, function (e) {
                Messages.error("Failure", e.data);
                ViewSpinner.stop();
            });
        };

        function fetchNetworks() {
            ViewSpinner.spin();
            Network.query({}, function (d) {
                $scope.networks = d;
                ViewSpinner.stop();
            }, function (e) {
                Messages.error("Failure", e.data);
                ViewSpinner.stop();
            });
        }
        fetchNetworks();
    }]);

angular.module('pullImage', [])
    .controller('PullImageController', ['$scope', '$log', 'Messages', 'Image', 'ViewSpinner',
        function ($scope, $log, Messages, Image, ViewSpinner) {
            $scope.template = 'app/components/pullImage/pullImage.html';

            $scope.init = function () {
                $scope.config = {
                    registry: '',
                    fromImage: '',
                    tag: 'latest'
                };
            };

            $scope.init();

            function failedRequestHandler(e, Messages) {
                Messages.error('Error', errorMsgFilter(e));
            }

            $scope.pull = function () {
                $('#error-message').hide();
                var imageName = ($scope.config.registry ? $scope.config.registry + '/' : '' ) +
                  ($scope.config.fromImage);
                var config = {};
                config.fromImage = imageName;
                config.tag = $scope.config.tag;

                ViewSpinner.spin();
                $('#pull-modal').modal('hide');
                Image.create(config, function (data) {
                    ViewSpinner.stop();
                    if (data.constructor === Array) {
                        var f = data.length > 0 && data[data.length - 1].hasOwnProperty('error');
                        //check for error
                        if (f) {
                            var d = data[data.length - 1];
                            $scope.error = "Cannot pull image " + imageName + " Reason: " + d.error;
                            $('#pull-modal').modal('show');
                            $('#error-message').show();
                        } else {
                            Messages.send("Image Added", imageName);
                            $scope.init();
                        }
                    } else {
                        Messages.send("Image Added", imageName);
                        $scope.init();
                    }
                }, function (e) {
                    ViewSpinner.stop();
                    $scope.error = "Cannot pull image " + imageName + " Reason: " + e.data;
                    $('#pull-modal').modal('show');
                    $('#error-message').show();
                });
            };
        }]);

angular.module('sidebar', [])
    .controller('SideBarController', ['$scope', 'Container', 'Settings',
        function ($scope, Container, Settings) {
            $scope.template = 'partials/sidebar.html';
            $scope.containers = [];
            $scope.endpoint = Settings.endpoint;

            Container.query({all: 0}, function (d) {
                $scope.containers = d;
            });
        }]);

angular.module('startContainer', ['ui.bootstrap'])
    .controller('StartContainerController', ['$scope', '$routeParams', '$location', 'Container', 'Messages', 'containernameFilter', 'errorMsgFilter',
        function ($scope, $routeParams, $location, Container, Messages, containernameFilter, errorMsgFilter) {
            $scope.template = 'app/components/startContainer/startcontainer.html';

            Container.query({all: 1}, function (d) {
                $scope.containerNames = d.map(function (container) {
                    return containernameFilter(container);
                });
            });

            $scope.config = {
                Env: [],
                Labels: [],
                Volumes: [],
                SecurityOpts: [],
                HostConfig: {
                    PortBindings: [],
                    Binds: [],
                    Links: [],
                    Dns: [],
                    DnsSearch: [],
                    VolumesFrom: [],
                    CapAdd: [],
                    CapDrop: [],
                    Devices: [],
                    LxcConf: [],
                    ExtraHosts: []
                }
            };

            $scope.menuStatus = {
                containerOpen: true,
                hostConfigOpen: false
            };

            function failedRequestHandler(e, Messages) {
                Messages.error('Error', errorMsgFilter(e));
            }

            function rmEmptyKeys(col) {
                for (var key in col) {
                    if (col[key] === null || col[key] === undefined || col[key] === '' || ($.isPlainObject(col[key]) && $.isEmptyObject(col[key])) || col[key].length === 0) {
                        delete col[key];
                    }
                }
            }

            function getNames(arr) {
                return arr.map(function (item) {
                    return item.name;
                });
            }

            $scope.create = function () {
                // Copy the config before transforming fields to the remote API format
                var config = angular.copy($scope.config);

                config.Image = $routeParams.id;

                if (config.Cmd && config.Cmd[0] === "[") {
                    config.Cmd = angular.fromJson(config.Cmd);
                } else if (config.Cmd) {
                    config.Cmd = config.Cmd.split(' ');
                }

                config.Env = config.Env.map(function (envar) {
                    return envar.name + '=' + envar.value;
                });
                var labels = {};
                config.Labels = config.Labels.forEach(function(label) {
                    labels[label.key] = label.value;
                });
                config.Labels = labels;

                config.Volumes = getNames(config.Volumes);
                config.SecurityOpts = getNames(config.SecurityOpts);

                config.HostConfig.VolumesFrom = getNames(config.HostConfig.VolumesFrom);
                config.HostConfig.Binds = getNames(config.HostConfig.Binds);
                config.HostConfig.Links = getNames(config.HostConfig.Links);
                config.HostConfig.Dns = getNames(config.HostConfig.Dns);
                config.HostConfig.DnsSearch = getNames(config.HostConfig.DnsSearch);
                config.HostConfig.CapAdd = getNames(config.HostConfig.CapAdd);
                config.HostConfig.CapDrop = getNames(config.HostConfig.CapDrop);
                config.HostConfig.LxcConf = config.HostConfig.LxcConf.reduce(function (prev, cur, idx) {
                    prev[cur.name] = cur.value;
                    return prev;
                }, {});
                config.HostConfig.ExtraHosts = config.HostConfig.ExtraHosts.map(function (entry) {
                    return entry.host + ':' + entry.ip;
                });

                var ExposedPorts = {};
                var PortBindings = {};
                config.HostConfig.PortBindings.forEach(function (portBinding) {
                    var intPort = portBinding.intPort + "/tcp";
                    if (portBinding.protocol === "udp") {
                        intPort = portBinding.intPort + "/udp";
                    }
                    var binding = {
                        HostIp: portBinding.ip,
                        HostPort: portBinding.extPort
                    };
                    if (portBinding.intPort) {
                        ExposedPorts[intPort] = {};
                        if (intPort in PortBindings) {
                            PortBindings[intPort].push(binding);
                        } else {
                            PortBindings[intPort] = [binding];
                        }
                    } else {
                        Messages.send('Warning', 'Internal port must be specified for PortBindings');
                    }
                });
                config.ExposedPorts = ExposedPorts;
                config.HostConfig.PortBindings = PortBindings;

                // Remove empty fields from the request to avoid overriding defaults
                rmEmptyKeys(config.HostConfig);
                rmEmptyKeys(config);

                var ctor = Container;
                var loc = $location;
                var s = $scope;
                Container.create(config, function (d) {
                    if (d.Id) {
                        ctor.start({id: d.Id}, {}, function (cd) {
                            Messages.send('Container Started', d.Id);
                            $('#create-modal').modal('hide');
                            loc.path('/containers/' + d.Id + '/');
                        }, function (e) {
                            failedRequestHandler(e, Messages);
                        });
                    } else {
                        failedRequestHandler(d, Messages);
                    }
                }, function (e) {
                    failedRequestHandler(e, Messages);
                });
            };

            $scope.addEntry = function (array, entry) {
                array.push(entry);
            };
            $scope.rmEntry = function (array, entry) {
                var idx = array.indexOf(entry);
                array.splice(idx, 1);
            };
        }]);

angular.module('stats', [])
    .controller('StatsController', ['Settings', '$scope', 'Messages', '$timeout', 'Container', '$routeParams', 'humansizeFilter', '$sce', function (Settings, $scope, Messages, $timeout, Container, $routeParams, humansizeFilter, $sce) {
        // TODO: Force scale to 0-100 for cpu, fix charts on dashboard,
        // TODO: Force memory scale to 0 - max memory

        var cpuLabels = [];
        var cpuData = [];
        var memoryLabels = [];
        var memoryData = [];
        var networkLabels = [];
        var networkTxData = [];
        var networkRxData = [];
        for (var i = 0; i < 20; i++) {
            cpuLabels.push('');
            cpuData.push(0);
            memoryLabels.push('');
            memoryData.push(0);
            networkLabels.push('');
            networkTxData.push(0);
            networkRxData.push(0);
        }
        var cpuDataset = { // CPU Usage
            fillColor: "rgba(151,187,205,0.5)",
            strokeColor: "rgba(151,187,205,1)",
            pointColor: "rgba(151,187,205,1)",
            pointStrokeColor: "#fff",
            data: cpuData
        };
        var memoryDataset = {
            fillColor: "rgba(151,187,205,0.5)",
            strokeColor: "rgba(151,187,205,1)",
            pointColor: "rgba(151,187,205,1)",
            pointStrokeColor: "#fff",
            data: memoryData
        };
        var networkRxDataset = {
            label: "Rx Bytes",
            fillColor: "rgba(151,187,205,0.5)",
            strokeColor: "rgba(151,187,205,1)",
            pointColor: "rgba(151,187,205,1)",
            pointStrokeColor: "#fff",
            data: networkRxData
        };
        var networkTxDataset = {
            label: "Tx Bytes",
            fillColor: "rgba(255,180,174,0.5)",
            strokeColor: "rgba(255,180,174,1)",
            pointColor: "rgba(255,180,174,1)",
            pointStrokeColor: "#fff",
            data: networkTxData
        };
        var networkLegendData = [
            {
                //value: '',
                color: 'rgba(151,187,205,0.5)',
                title: 'Rx Data'
            },
            {
                //value: '',
                color: 'rgba(255,180,174,0.5)',
                title: 'Rx Data'
            }];
        legend($('#network-legend').get(0), networkLegendData);

        Chart.defaults.global.animationSteps = 30; // Lower from 60 to ease CPU load.
        var cpuChart = new Chart($('#cpu-stats-chart').get(0).getContext("2d")).Line({
            labels: cpuLabels,
            datasets: [cpuDataset]
        }, {
            responsive: true
        });

        var memoryChart = new Chart($('#memory-stats-chart').get(0).getContext('2d')).Line({
                labels: memoryLabels,
                datasets: [memoryDataset]
            },
            {
                scaleLabel: function (valueObj) {
                    return humansizeFilter(parseInt(valueObj.value, 10));
                },
                responsive: true
                //scaleOverride: true,
                //scaleSteps: 10,
                //scaleStepWidth: Math.ceil(initialStats.memory_stats.limit / 10),
                //scaleStartValue: 0
            });
        var networkChart = new Chart($('#network-stats-chart').get(0).getContext("2d")).Line({
            labels: networkLabels,
            datasets: [networkRxDataset, networkTxDataset]
        }, {
            scaleLabel: function (valueObj) {
                return humansizeFilter(parseInt(valueObj.value, 10));
            },
            responsive: true
        });
        $scope.networkLegend = $sce.trustAsHtml(networkChart.generateLegend());

        function updateStats() {
            Container.stats({id: $routeParams.id}, function (d) {
                var arr = Object.keys(d).map(function (key) {
                    return d[key];
                });
                if (arr.join('').indexOf('no such id') !== -1) {
                    Messages.error('Unable to retrieve stats', 'Is this container running?');
                    return;
                }

                // Update graph with latest data
                $scope.data = d;
                updateCpuChart(d);
                updateMemoryChart(d);
                updateNetworkChart(d);
                timeout = $timeout(updateStats, 5000);
            }, function () {
                Messages.error('Unable to retrieve stats', 'Is this container running?');
                timeout = $timeout(updateStats, 5000);
            });
        }

        var timeout;
        $scope.$on('$destroy', function () {
            $timeout.cancel(timeout);
        });

        updateStats();

        function updateCpuChart(data) {
            cpuChart.addData([calculateCPUPercent(data)], new Date(data.read).toLocaleTimeString());
            cpuChart.removeData();
        }

        function updateMemoryChart(data) {
            memoryChart.addData([data.memory_stats.usage], new Date(data.read).toLocaleTimeString());
            memoryChart.removeData();
        }

        var lastRxBytes = 0, lastTxBytes = 0;

        function updateNetworkChart(data) {
            // 1.9+ contains an object of networks, for now we'll just show stats for the first network
            // TODO: Show graphs for all networks
            if (data.networks) {
                $scope.networkName = Object.keys(data.networks)[0];
                data.network = data.networks[$scope.networkName];
            }
            var rxBytes = 0, txBytes = 0;
            if (lastRxBytes !== 0 || lastTxBytes !== 0) {
                // These will be zero on first call, ignore to prevent large graph spike
                rxBytes = data.network.rx_bytes - lastRxBytes;
                txBytes = data.network.tx_bytes - lastTxBytes;
            }
            lastRxBytes = data.network.rx_bytes;
            lastTxBytes = data.network.tx_bytes;
            networkChart.addData([rxBytes, txBytes], new Date(data.read).toLocaleTimeString());
            networkChart.removeData();
        }

        function calculateCPUPercent(stats) {
            // Same algorithm the official client uses: https://github.com/docker/docker/blob/master/api/client/stats.go#L195-L208
            var prevCpu = stats.precpu_stats;
            var curCpu = stats.cpu_stats;

            var cpuPercent = 0.0;

            // calculate the change for the cpu usage of the container in between readings
            var cpuDelta = curCpu.cpu_usage.total_usage - prevCpu.cpu_usage.total_usage;
            // calculate the change for the entire system between readings
            var systemDelta = curCpu.system_cpu_usage - prevCpu.system_cpu_usage;

            if (systemDelta > 0.0 && cpuDelta > 0.0) {
                cpuPercent = (cpuDelta / systemDelta) * curCpu.cpu_usage.percpu_usage.length * 100.0;
            }
            return cpuPercent;
        }

        Container.get({id: $routeParams.id}, function (d) {
            $scope.containerName = d.Name.substring(1);
        }, function (e) {
            Messages.error("Failure", e.data);
        });
    }])
;
angular.module('volumes', []).config(['$routeProvider', function ($routeProvider) {
    $routeProvider.when('/volumes/', {
        templateUrl: 'app/components/volumes/volumes.html',
        controller: 'VolumesController'
    });
}]).controller('VolumesController', ['$scope', 'Volume', 'ViewSpinner', 'Messages', '$route', 'errorMsgFilter',
    function ($scope, Volume, ViewSpinner, Messages, $route, errorMsgFilter) {
        $scope.sortType = 'Name';
        $scope.sortReverse = true;
        $scope.toggle = false;
        $scope.order = function(sortType) {
            $scope.sortReverse = ($scope.sortType === sortType) ? !$scope.sortReverse : false;
            $scope.sortType = sortType;
        };
        $scope.createVolumeConfig = {
            "Name": "",
            "Driver": ""
        };



        $scope.removeAction = function () {
            ViewSpinner.spin();
            var counter = 0;
            var complete = function () {
                counter = counter - 1;
                if (counter === 0) {
                    ViewSpinner.stop();
                }
            };
            angular.forEach($scope.volumes, function (volume) {
                if (volume.Checked) {
                    counter = counter + 1;
                    Volume.remove({name: volume.Name}, function (d) {
                        Messages.send("Volume deleted", volume.Name);
                        var index = $scope.volumes.indexOf(volume);
                        $scope.volumes.splice(index, 1);
                        complete();
                    }, function (e) {
                        Messages.error("Failure", e.data);
                        complete();
                    });
                }
            });
        };

        $scope.toggleSelectAll = function () {
            angular.forEach($scope.filteredVolumes, function (i) {
                i.Checked = $scope.toggle;
            });
        };

        $scope.addVolume = function addVolume(createVolumeConfig) {
            ViewSpinner.spin();
            Volume.create(createVolumeConfig, function (d) {
                if (d.Name) {
                    Messages.send("Volume created", d.Name);
                } else {
                    Messages.error('Failure', errorMsgFilter(d));
                }
                ViewSpinner.stop();
                fetchVolumes();
            }, function (e) {
                Messages.error("Failure", e.data);
                ViewSpinner.stop();
            });
        };

        function fetchVolumes() {
            ViewSpinner.spin();
            Volume.query({}, function (d) {
                $scope.volumes = d.Volumes;
                ViewSpinner.stop();
            }, function (e) {
                Messages.error("Failure", e.data);
                ViewSpinner.stop();
            });
        }
        fetchVolumes();
    }]);

angular.module('uifordocker.filters', [])
    .filter('truncate', function () {
        'use strict';
        return function (text, length, end) {
            if (isNaN(length)) {
                length = 10;
            }

            if (end === undefined) {
                end = '...';
            }

            if (text.length <= length || text.length - end.length <= length) {
                return text;
            }
            else {
                return String(text).substring(0, length - end.length) + end;
            }
        };
    })
    .filter('statusbadge', function () {
        'use strict';
        return function (text) {
            if (text === 'Ghost') {
                return 'important';
            } 
        else if (text.indexOf('Exit') !== -1 && text !== 'Exit 0' || text ==='Created') {
                return 'default';
            }
        else if (text === '') {
            return 'danger';
        }
            return 'success';
        };
    })
    .filter('dashboard_status', function () {
        'use strict';
        return function (state) {
            if (state === '') {
                return 'Stopped';
            }
            else if (state === 'Ghost') {
                return 'Ghost';
            }
            else if (state === 'Created'){
                return 'Created';
            }
            else if (state.indexOf('Exit') !== -1 && state !== 'Exit 0') {
                return 'Stopped';
            }
            else {
            var s = 'Running - ' + state;
                    return s;
            }
        };
    })
    .filter('runstopbtn', function () {
        'use strict';
        return function (text) {
            if (text === '') {
                return 'success';   // start button
            }
            else if (text === 'Created') {
                return 'success'
            }
            else if (text.indexOf('Exit') !== -1 && text !== 'Exit 0') {
                return 'success';
            }
            else {
                return 'danger';    // stop button
            }
        };
    })

    .filter('runstopbtn_text', function () {
        'use strict';
        return function (text) {
            if (text === '' || text === 'Created') {
                return 'Pipeline detail';   // start button
            }
            else if (text.indexOf('Exit') !== -1 && text !== 'Exit 0') {
                return 'Pipeline detail';
            }
            else {
                return 'Pipeline detail';    // stop button
            }
        };
    })

    .filter('getstatetext', function () {
        'use strict';
        return function (state) {
            if (state === undefined) {
                return 'Stopped';
            }
            if (state.Ghost && state.Running) {
                return 'Ghost';
            }
            if (state.Running && state.Paused) {
                return 'Running (Paused)';
            }
            if (state.Running) {
                return 'Running';
            }
            return 'Stopped';
        };
    })
    .filter('getstatelabel', function () {
        'use strict';
        return function (state) {
            if (state === undefined) {
                return 'label-default';
            }
            if (state.Ghost && state.Running) {
                return 'label-important';
            }
            if (state.Running) {
                return 'label-success';
            }
            return 'label-default';
        };
    })
    .filter('humansize', function () {
        'use strict';
        return function (bytes) {
            var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            if (bytes === 0) {
                return 'n/a';
            }
            var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10);
            var value = bytes / Math.pow(1024, i);
            var decimalPlaces = (i < 1) ? 0 : (i - 1);
            return value.toFixed(decimalPlaces) + ' ' + sizes[[i]];
        };
    })
    .filter('containername', function () {
        'use strict';
        return function (container) {
            if(typeof(test_container)=='undefined') {
                window.test_container = [];
            }
            test_container.push(container);
            var name = container.Names[0];
            return name.substring(1, name.length);
        };
    })
    .filter('repotag', function () {
        'use strict';
        return function (image) {
            if (image.RepoTags && image.RepoTags.length > 0) {
                window.test_repotag = image;
                var tag = image.RepoTags[0];
                if (tag === '<none>:<none>') {
                    tag = '';
                }
                return tag;
            }
            return '';
        };
    })
    .filter('reponameOnly', function() {
        'use strict';
        return function (image) {
            if (image.RepoTags && image.RepoTags.length > 0) {
                var tag = image.RepoTags[0];
                var tag_size = tag.split(':').length;
                if (tag_size>1) {
                    if (tag === '<none>:<none>') {
                        return '';
                    }
                    else {
                        return tag.split(':')[0];
                    }
                }
                return tag;
            }
            else if (image.Image && image.Image.length > 0) {
                var tag = image.Image
                var tag_size = tag.split(':').length;
                if (tag_size>1) {
                    if (tag === '<none>:<none>') {
                        return '';
                    }
                    else {
                        return tag.split(':')[1];
                    }
                }
                return tag;
            }
            return '';
        }
    })
    .filter('tagnameOnly', function() {
        'use strict';
        return function (image) {
            window.test_tagnameOnly_test = image;
            if (image !== undefined){
                if (image.RepoTags && image.RepoTags.length > 0) {
                    var tag = image.RepoTags[0];
                    var tag_size = tag.split(':').length;
                    if (tag_size>1) {
                        if (tag === '<none>:<none>') {
                            return '';
                        }
                        else {
                            return tag.split(':')[0];
                        }
                    }
                    return tag;
                }
                else if (image.Image && image.Image.length > 0) {
                    var tag = image.Image
                    var tag_size = tag.split(':').length;
                    if (tag_size>1) {
                        if (tag === '<none>:<none>') {
                            return '';
                        }
                        else {
                            return tag.split(':')[1];
                        }
                    }
                    return tag;
                }

                return '';
            }
            return image;
        }
    })
    .filter('getStartedTime',function() {
        'use strict';
        return function (container) {
            if (container.Status != '') {
                var d = new Date(container.Created * 1000)
                var locTime = d.toLocaleString()
                return locTime;
            }
            return '';
        }
    })
    .filter('getdate', function () {
        'use strict';
        return function (data) {
            //Multiply by 1000 for the unix format
            var date = new Date(data * 1000);
            return date.toDateString();
        };
    })
    .filter('errorMsg', function () {
        return function (object) {
            var idx = 0;
            var msg = '';
            while (object[idx] && typeof(object[idx]) === 'string') {
                msg += object[idx];
                idx++;
            }
            return msg;
        };
    })
    .filter('chk_containers', function() {
        return function (c) {
            window.test_containers = c;
        }
    })
    .filter('getimage', function() {
        return function (img) {
            window.test_image_create = img;
        }
    });



angular.module('uifordocker.services', ['ngResource', 'ngSanitize'])
    .factory('Container', ['$resource', 'Settings', function ContainerFactory($resource, Settings) {
        'use strict';
        // Resource for interacting with the docker containers
        // http://docs.docker.com/reference/api/docker_remote_api_v1.20/#2-1-containers
        return $resource(Settings.url + '/containers/:id/:action', {
            name: '@name'
        }, {
            query: {method: 'GET', params: {all: 0, action: 'json'}, isArray: true},
            get: {method: 'GET', params: {action: 'json'}},
            start: {method: 'POST', params: {id: '@id', action: 'start'}},
            stop: {method: 'POST', params: {id: '@id', t: 5, action: 'stop'}},
            restart: {method: 'POST', params: {id: '@id', t: 5, action: 'restart'}},
            kill: {method: 'POST', params: {id: '@id', action: 'kill'}},
            pause: {method: 'POST', params: {id: '@id', action: 'pause'}},
            unpause: {method: 'POST', params: {id: '@id', action: 'unpause'}},
            changes: {method: 'GET', params: {action: 'changes'}, isArray: true},
            create: {method: 'POST', params: {action: 'create'}},
            remove: {method: 'DELETE', params: {id: '@id', v: 0}},
            rename: {method: 'POST', params: {id: '@id', action: 'rename'}, isArray: false},
            stats: {method: 'GET', params: {id: '@id', stream: false, action: 'stats'}, timeout: 5000}
        });
    }])
    .factory('ContainerCommit', ['$resource', '$http', 'Settings', function ContainerCommitFactory($resource, $http, Settings) {
        'use strict';
        // http://docs.docker.com/reference/api/docker_remote_api_v1.20/#create-a-new-image-from-a-container-s-changes
        return {
            commit: function (params, callback) {
                $http({
                    method: 'POST',
                    url: Settings.url + '/commit',
                    params: {
                        'container': params.id,
                        'tag': params.tag || null,
                        'repo': params.repo || null
                    },
                    data: params.config
                }).success(callback).error(function (data, status, headers, config) {
                    console.log(error, data);
                });
            }
        };
    }])
    .factory('ContainerLogs', ['$resource', '$http', 'Settings', function ContainerLogsFactory($resource, $http, Settings) {
        'use strict';
        // http://docs.docker.com/reference/api/docker_remote_api_v1.20/#get-container-logs
        return {
            get: function (id, params, callback) {
                $http({
                    method: 'GET',
                    url: Settings.url + '/containers/' + id + '/logs',
                    params: {
                        'stdout': params.stdout || 0,
                        'stderr': params.stderr || 0,
                        'timestamps': params.timestamps || 0,
                        'tail': params.tail || 'all'
                    }
                }).success(callback).error(function (data, status, headers, config) {
                    console.log(error, data);
                });
            }
        };
    }])
    .factory('ContainerTop', ['$http', 'Settings', function ($http, Settings) {
        'use strict';
        // http://docs.docker.com/reference/api/docker_remote_api_v1.20/#list-processes-running-inside-a-container
        return {
            get: function (id, params, callback, errorCallback) {
                $http({
                    method: 'GET',
                    url: Settings.url + '/containers/' + id + '/top',
                    params: {
                        ps_args: params.ps_args
                    }
                }).success(callback);
            }
        };
    }])
    .factory('Image', ['$resource', 'Settings', function ImageFactory($resource, Settings) {
        'use strict';
        // http://docs.docker.com/reference/api/docker_remote_api_v1.20/#2-2-images
        return $resource(Settings.url + '/images/:id/:action', {}, {
            query: {method: 'GET', params: {all: 0, action: 'json'}, isArray: true},
            get: {method: 'GET', params: {action: 'json'}},
            search: {method: 'GET', params: {action: 'search'}},
            history: {method: 'GET', params: {action: 'history'}, isArray: true},
            create: {
                method: 'POST', isArray: true, transformResponse: [function f(data) {
                    var str = data.replace(/\n/g, " ").replace(/\}\W*\{/g, "}, {");
                    return angular.fromJson("[" + str + "]");
                }],
                params: {action: 'create', fromImage: '@fromImage', tag: '@tag'}
            },
            insert: {method: 'POST', params: {id: '@id', action: 'insert'}},
            push: {method: 'POST', params: {id: '@id', action: 'push'}},
            tag: {method: 'POST', params: {id: '@id', action: 'tag', force: 0, repo: '@repo', tag: '@tag'}},
            remove: {method: 'DELETE', params: {id: '@id'}, isArray: true},
            inspect: {method: 'GET', params: {id: '@id', action: 'json'}}
        });
    }])
    .factory('Version', ['$resource', 'Settings', function VersionFactory($resource, Settings) {
        'use strict';
        // http://docs.docker.com/reference/api/docker_remote_api_v1.20/#show-the-docker-version-information
        return $resource(Settings.url + '/version', {}, {
            get: {method: 'GET'}
        });
    }])
    .factory('Auth', ['$resource', 'Settings', function AuthFactory($resource, Settings) {
        'use strict';
        // http://docs.docker.com/reference/api/docker_remote_api_v1.20/#check-auth-configuration
        return $resource(Settings.url + '/auth', {}, {
            get: {method: 'GET'},
            update: {method: 'POST'}
        });
    }])
    .factory('Info', ['$resource', 'Settings', function InfoFactory($resource, Settings) {
        'use strict';
        // http://docs.docker.com/reference/api/docker_remote_api_v1.20/#display-system-wide-information
        return $resource(Settings.url + '/info', {}, {
            get: {method: 'GET'}
        });
    }])
    .factory('Network', ['$resource', 'Settings', function NetworkFactory($resource, Settings) {
        'use strict';
        // http://docs.docker.com/reference/api/docker_remote_api_v1.20/#2-5-networks
        return $resource(Settings.url + '/networks/:id/:action', {id: '@id'}, {
            query: {method: 'GET', isArray: true},
            get: {method: 'GET'},
            create: {method: 'POST', params: {action: 'create'}},
            remove: {method: 'DELETE'},
            connect: {method: 'POST', params: {action: 'connect'}},
            disconnect: {method: 'POST', params: {action: 'disconnect'}}
        });
    }])
    .factory('Volume', ['$resource', 'Settings', function VolumeFactory($resource, Settings) {
        'use strict';
        // http://docs.docker.com/reference/api/docker_remote_api_v1.20/#2-5-networks
        return $resource(Settings.url + '/volumes/:name/:action', {name: '@name'}, {
            query: {method: 'GET'},
            get: {method: 'GET'},
            create: {method: 'POST', params: {action: 'create'}},
            remove: {method: 'DELETE'}
        });
    }])
    .factory('Settings', ['DOCKER_ENDPOINT', 'DOCKER_PORT', 'UI_VERSION', function SettingsFactory(DOCKER_ENDPOINT, DOCKER_PORT, UI_VERSION) {
        'use strict';
        var url = DOCKER_ENDPOINT;
        if (DOCKER_PORT) {
            url = url + DOCKER_PORT + '\\' + DOCKER_PORT;
        }
        var firstLoad = (localStorage.getItem('firstLoad') || 'true') === 'true';
        return {
            displayAll: false,
            endpoint: DOCKER_ENDPOINT,
            uiVersion: UI_VERSION,
            url: url,
            firstLoad: firstLoad
        };
    }])
    .factory('ViewSpinner', function ViewSpinnerFactory() {
        'use strict';
        var spinner = new Spinner();
        var target = document.getElementById('view');

        return {
            spin: function () {
                spinner.spin(target);
            },
            stop: function () {
                spinner.stop();
            }
        };
    })
    .factory('Messages', ['$rootScope', '$sanitize', function MessagesFactory($rootScope, $sanitize) {
        'use strict';
        return {
            send: function (title, text) {
                $.gritter.add({
                    title: $sanitize(title),
                    text: $sanitize(text),
                    time: 2000,
                    before_open: function () {
                        if ($('.gritter-item-wrapper').length === 3) {
                            return false;
                        }
                    }
                });
            },
            error: function (title, text) {
                $.gritter.add({
                    title: $sanitize(title),
                    text: $sanitize(text),
                    time: 10000,
                    before_open: function () {
                        if ($('.gritter-item-wrapper').length === 4) {
                            return false;
                        }
                    }
                });
            }
        };
    }])
    .factory('LineChart', ['Settings', function LineChartFactory(Settings) {
        'use strict';
        return {
            build: function (id, data, getkey) {
                var chart = new Chart($(id).get(0).getContext("2d"));
                var map = {};

                for (var i = 0; i < data.length; i++) {
                    var c = data[i];
                    var key = getkey(c);

                    var count = map[key];
                    if (count === undefined) {
                        count = 0;
                    }
                    count += 1;
                    map[key] = count;
                }

                var labels = [];
                data = [];
                var keys = Object.keys(map);
                var max = 1;

                for (i = keys.length - 1; i > -1; i--) {
                    var k = keys[i];
                    labels.push(k);
                    data.push(map[k]);
                    if (map[k] > max) {
                        max = map[k];
                    }
                }
                var steps = Math.min(max, 10);
                var dataset = {
                    fillColor: "rgba(151,187,205,0.5)",
                    strokeColor: "rgba(151,187,205,1)",
                    pointColor: "rgba(151,187,205,1)",
                    pointStrokeColor: "#fff",
                    data: data
                };
                chart.Line({
                        labels: labels,
                        datasets: [dataset]
                    },
                    {
                        scaleStepWidth: Math.ceil(max / steps),
                        pointDotRadius: 1,
                        scaleIntegersOnly: true,
                        scaleOverride: true,
                        scaleSteps: steps
                    });
            }
        };
    }]);

function ImageViewModel(data) {
    this.Id = data.Id;
    this.Tag = data.Tag;
    this.Repository = data.Repository;
    this.Created = data.Created;
    this.Checked = false;
    this.RepoTags = data.RepoTags;
    this.VirtualSize = data.VirtualSize;
}

function ContainerViewModel(data) {
    this.Id = data.Id;
    this.Image = data.Image;
    this.Command = data.Command;
    this.Created = data.Created;
    this.SizeRw = data.SizeRw;
    this.Status = data.Status;
    this.Checked = false;
    this.Names = data.Names;
}

angular.module('uifordocker.templates', ['app/components/builder/builder.html', 'app/components/container/container.html', 'app/components/containerLogs/containerlogs.html', 'app/components/containerTop/containerTop.html', 'app/components/containers/containers.html', 'app/components/containersNetwork/containersNetwork.html', 'app/components/dashboard/dashboard.html', 'app/components/events/events.html', 'app/components/footer/statusbar.html', 'app/components/image/image.html', 'app/components/images/images.html', 'app/components/info/info.html', 'app/components/masthead/masthead.html', 'app/components/network/network.html', 'app/components/networks/networks.html', 'app/components/pullImage/pullImage.html', 'app/components/sidebar/sidebar.html', 'app/components/startContainer/startcontainer.html', 'app/components/stats/stats.html', 'app/components/volumes/volumes.html']);

angular.module("app/components/builder/builder.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("app/components/builder/builder.html",
    "<div id=\"build-modal\" class=\"modal fade\">\n" +
    "    <div class=\"modal-dialog\">\n" +
    "        <div class=\"modal-content\">\n" +
    "            <div class=\"modal-header\">\n" +
    "                <button type=\"button\" class=\"close\" data-dismiss=\"modal\" aria-hidden=\"true\">&times;</button>\n" +
    "                <h3>Build Image</h3>\n" +
    "            </div>\n" +
    "            <div class=\"modal-body\">\n" +
    "                <div id=\"editor\"></div>\n" +
    "                <p>{{ messages }}</p>\n" +
    "            </div>\n" +
    "            <div class=\"modal-footer\">\n" +
    "                <a href=\"\" class=\"btn btn-primary\" ng-click=\"build()\">Build</a>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "</div>\n" +
    "");
}]);

angular.module("app/components/container/container.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("app/components/container/container.html",
    "<div class=\"detail\">\n" +
    "\n" +
    "    <div ng-if=\"!container.edit\">\n" +
    "        <h3>Pipeline: {{ container.Config | tagnameOnly }}</h4>\n" +
    "        <h4>Username: {{ container.Name }}\n" +
    "            <button class=\"btn btn-primary btn-xs\" id=\"rename_btn\"\n" +
    "                    ng-click=\"container.edit = true;\">Rename\n" +
    "            </button>\n" +
    "        </h3>\n" +
    "    </div>\n" +
    "    <div ng-if=\"container.edit\">\n" +
    "        <h4>\n" +
    "            Enter Your Name/ID:\n" +
    "            <input type=\"text\" id=\"rename_input\" ng-model=\"container.newContainerName\">\n" +
    "            <button class=\"btn btn-success\"\n" +
    "                    ng-click=\"renameContainer()\">Save\n" +
    "            </button>\n" +
    "            <button class=\"btn btn-danger\"\n" +
    "                    ng-click=\"container.edit = false;\">&times;</button>\n" +
    "        </h4>\n" +
    "    </div>\n" +
    "\n" +
    "    <div class=\"btn-group detail\">\n" +
    "        <button class=\"btn btn-success\"\n" +
    "                ng-click=\"start()\"\n" +
    "                ng-show=\"!container.State.Running && !container.edit\">Start pipeline\n" +
    "        </button>\n" +
    "        <button class=\"btn btn-info\"\n" +
    "                ng-click=\"pause()\"\n" +
    "                ng-show=\"container.State.Running && !container.State.Paused\">Pause pipeline\n" +
    "        </button>\n" +
    "        <button class=\"btn btn-success\"\n" +
    "                ng-click=\"unpause()\"\n" +
    "                ng-show=\"container.State.Running && container.State.Paused\">Unpause pipeline\n" +
    "        </button>\n" +
    "        <button class=\"btn btn-warning\"\n" +
    "                ng-click=\"stop()\"\n" +
    "                ng-show=\"container.State.Running && !container.State.Paused\">Save/Stop pipeline\n" +
    "        </button>\n" +
    "        <button class=\"btn btn-danger\"\n" +
    "                ng-click=\"kill()\"\n" +
    "                ng-show=\"container.State.Running && !container.State.Paused\">Disregard/Stop pipeline\n" +
    "        </button>\n" +
    "        <button class=\"btn btn-primary\"\n" +
    "                ng-click=\"restart()\"\n" +
    "                ng-show=\"container.State.Running && !container.State.Stopped\">Restart pipeline\n" +
    "        </button>\n" +
    "    </div>\n" +
    "\n" +
    "    <table class=\"table table-striped\">\n" +
    "        <tbody>\n" +
    "        <tr>\n" +
    "            <td>State:</td>\n" +
    "            <td>\n" +
    "                <li>\n" +
    "                    <span class=\"label {{ container.State|getstatelabel }}\">{{ container.State|getstatetext }}</span>\n" +
    "                </li>\n" +
    "            </td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Environment:</td>\n" +
    "            <td>\n" +
    "                <div ng-show=\"!editEnv\">\n" +
    "                    <button class=\"btn btn-default btn-xs pull-right\" ng-click=\"editEnv = false\"><!--<i class=\"glyphicon glyphicon-pencil\"></i>--></button>\n" +
    "                    <ul>\n" +
    "                        <li ng-repeat=\"k in container.Config.Env\">{{ k }}</li>\n" +
    "                    </ul>\n" +
    "                </div>\n" +
    "                <div class=\"form-group\" ng-show=\"editEnv\">\n" +
    "                    <label>Env:</label>\n" +
    "\n" +
    "                    <div ng-repeat=\"envar in newCfg.Env\">\n" +
    "                        <div class=\"form-group form-inline\">\n" +
    "                            <div class=\"form-group\">\n" +
    "                                <label class=\"sr-only\">Variable Name:</label>\n" +
    "                                <input type=\"text\" ng-model=\"envar.name\" class=\"form-control input-sm\"\n" +
    "                                       placeholder=\"NAME\"/>\n" +
    "                            </div>\n" +
    "                            <div class=\"form-group\">\n" +
    "                                <label class=\"sr-only\">Variable Value:</label>\n" +
    "                                <input type=\"text\" ng-model=\"envar.value\" class=\"form-control input-sm\" style=\"width: 400px\"\n" +
    "                                       placeholder=\"value\"/>\n" +
    "                            </div>\n" +
    "                            <div class=\"form-group\">\n" +
    "                                <button class=\"btn btn-danger btn-sm input-sm form-control\"\n" +
    "                                        ng-click=\"rmEntry(newCfg.Env, envar)\"><i class=\"glyphicon glyphicon-remove\"></i>\n" +
    "                                </button>\n" +
    "                            </div>\n" +
    "                        </div>\n" +
    "                    </div>\n" +
    "                    <button type=\"button\" class=\"btn btn-success btn-sm\"\n" +
    "                            ng-click=\"addEntry(newCfg.Env, {name: '', value: ''})\"><i class=\"glyphicon glyphicon-plus\"></i> Add\n" +
    "                    </button>\n" +
    "                    <button class=\"btn btn-primary btn-sm\"\n" +
    "                            ng-click=\"restartEnv()\"\n" +
    "                            ng-show=\"!container.State.Restarting\">Commit and restart</button>\n" +
    "                </div>\n" +
    "\n" +
    "\n" +
    "            </td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Internal Port:</td>\n" +
    "            <td>\n" +
    "                <li ng-repeat=\"(k, v) in container.Config.ExposedPorts\">{{ k }}</li>\n" +
    "            </td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Exposed Port:</td>\n" +
    "            <td>\n" +
    "                <li ng-repeat=\"(containerport, hostports) in container.HostConfig.PortBindings\">\n" +
    "                    <span ng-repeat=\"(k,v) in hostports\">{{ v.HostPort }}/tcp</span>\n" +
    "                </li>\n" +
    "            </td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Bindings:</td>\n" +
    "            <td>\n" +
    "                <div ng-show=\"!editBinds\">\n" +
    "                    <button class=\"btn btn-default btn-xs pull-right\" ng-click=\"editBinds=false\"><!-- <i class=\"glyphicon glyphicon-pencil\"></i> --></button>\n" +
    "                    <ul>\n" +
    "                        <li ng-repeat=\"b in container.HostConfig.Binds\">{{ b }}</li>\n" +
    "                    </ul>\n" +
    "                </div>\n" +
    "                <div ng-show=\"editBinds\">\n" +
    "                    <div ng-repeat=\"(vol, b) in newCfg.Binds\" class=\"form-group form-inline\">\n" +
    "                        <div class=\"form-group\">\n" +
    "                            <input type=\"text\" ng-model=\"b.HostPath\" class=\"form-control input-sm\"\n" +
    "                                   placeholder=\"Host path or volume name\" style=\"width: 250px;\" />\n" +
    "                        </div>\n" +
    "                        <div class=\"form-group\">\n" +
    "                            <input type=\"text\" ng-model=\"b.ContPath\" ng-readonly=\"b.DefaultBind\" class=\"form-control input-sm\" placeholder=\"Container path\" />\n" +
    "                        </div>\n" +
    "                        <div class=\"form-group\">\n" +
    "                            <label><input type=\"checkbox\" ng-model=\"b.ReadOnly\" /> read only</label>\n" +
    "                        </div>\n" +
    "                        <div class=\"form-group\">\n" +
    "                            <button class=\"btn btn-danger btn-sm input-sm form-control\"\n" +
    "                                    ng-click=\"rmEntry(newCfg.Binds, b)\"><i class=\"glyphicon glyphicon-remove\"></i>\n" +
    "                            </button>\n" +
    "                        </div>\n" +
    "                    </div>\n" +
    "                    <button type=\"button\" class=\"btn btn-success btn-sm\"\n" +
    "                            ng-click=\"addEntry(newCfg.Binds, { ContPath: '', HostPath: '', ReadOnly: false, DefaultBind: false })\"><i class=\"glyphicon glyphicon-plus\"></i> Add\n" +
    "                    </button>\n" +
    "                    <button class=\"btn btn-primary btn-sm\"\n" +
    "                            ng-click=\"restartEnv()\"\n" +
    "                            ng-show=\"!container.State.Restarting\">Commit and restart</button>\n" +
    "\n" +
    "                </div>\n" +
    "            </td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Galaxy Server:</td>\n" +
    "            <td id=\"galaxy_server_info\">\n" +
    "                <li ng-repeat=\"(containerport, hostports) in container.HostConfig.PortBindings\">\n" +
    "                    <h4><span class=\"label label-primary\" ng-repeat=\"(k,v) in hostports\"><a href=\"http://{{ v.HostIp }}:{{ v.HostPort }}\" target=\"_blank\" style=\"color: white\">{{ v.HostIp }}:{{ v.HostPort }}</a></span></h4>\n" +
    "                </li>\n" +
    "            </td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Output / Error messages:</td>\n" +
    "            <td>\n" +
    "                <li>\n" +
    "                    <a href=\"#/containers/{{ container.Id }}/logs\">Output / Error messages</a>\n" +
    "                </li>\n" +
    "            </td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>System Stats:</td>\n" +
    "            <td>\n" +
    "                <li>\n" +
    "                    <a href=\"#/containers/{{ container.Id }}/stats\">Stats</a>\n" +
    "                </li>\n" +
    "            </td>\n" +
    "        </tr>\n" +
    "</div>\n" +
    "\n" +
    "\n" +
    "");
}]);

angular.module("app/components/containerLogs/containerlogs.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("app/components/containerLogs/containerlogs.html",
    "<div class=\"row logs\">\n" +
    "    <div class=\"col-xs-12\">\n" +
    "        <h4>Logs for container: <a href=\"#/containers/{{ container.Id }}/\">{{ container.Name }}</a></td></h4>\n" +
    "\n" +
    "        <div class=\"btn-group detail\">\n" +
    "            <button class=\"btn btn-info\" ng-click=\"scrollTo('stdout')\">stdout</button>\n" +
    "            <button class=\"btn btn-warning\" ng-click=\"scrollTo('stderr')\">stderr</button>\n" +
    "        </div>\n" +
    "        <div class=\"pull-right col-xs-6\">\n" +
    "            <div class=\"col-xs-6\">\n" +
    "                <a class=\"btn btn-primary\" ng-click=\"toggleTail()\" role=\"button\">Reload logs</a>\n" +
    "                <input id=\"tailLines\" type=\"number\" ng-style=\"{width: '45px'}\"\n" +
    "                       ng-model=\"tailLines\" ng-keypress=\"($event.which === 13)? toggleTail() : 0\"/>\n" +
    "                <label for=\"tailLines\">lines</label>\n" +
    "            </div>\n" +
    "            <div class=\"col-xs-4\">\n" +
    "                <input id=\"timestampToggle\" type=\"checkbox\" ng-model=\"showTimestamps\"\n" +
    "                       ng-change=\"toggleTimestamps()\"/> <label for=\"timestampToggle\">Timestamps</label>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "\n" +
    "    <div class=\"col-xs-12\">\n" +
    "        <div class=\"panel panel-default\">\n" +
    "            <div class=\"panel-heading\">\n" +
    "                <h3 id=\"stdout\" class=\"panel-title\">STDOUT</h3>\n" +
    "            </div>\n" +
    "            <div class=\"panel-body\">\n" +
    "                <pre id=\"stdoutLog\" class=\"pre-scrollable pre-x-scrollable\">{{stdout}}</pre>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "    <div class=\"col-xs-12\">\n" +
    "        <div class=\"panel panel-default\">\n" +
    "            <div class=\"panel-heading\">\n" +
    "                <h3 id=\"stderr\" class=\"panel-title\">STDERR</h3>\n" +
    "            </div>\n" +
    "            <div class=\"panel-body\">\n" +
    "                <pre id=\"stderrLog\" class=\"pre-scrollable pre-x-scrollable\">{{stderr}}</pre>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "</div>\n" +
    "");
}]);

angular.module("app/components/containerTop/containerTop.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("app/components/containerTop/containerTop.html",
    "<div class=\"containerTop\">\n" +
    "    <div class=\"row\">\n" +
    "        <div class=\"col-xs-12\">\n" +
    "            <h1>Top for: {{ containerName }}</h1>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "    <div class=\"row\">\n" +
    "        <div class=\"form-group col-xs-2\">\n" +
    "            <input type=\"text\" class=\"form-control\" placeholder=\"[options] (aux)\" ng-model=\"ps_args\">\n" +
    "        </div>\n" +
    "        <button type=\"button\" class=\"btn btn-default\" ng-click=\"getTop()\">Submit</button>\n" +
    "    </div>\n" +
    "    <div class=\"row\">\n" +
    "        <div class=\"col-xs-12\">\n" +
    "            <table class=\"table table-striped\">\n" +
    "                <thead>\n" +
    "                <tr>\n" +
    "                    <th ng-repeat=\"title in containerTop.Titles\">{{title}}</th>\n" +
    "                </tr>\n" +
    "                </thead>\n" +
    "                <tbody>\n" +
    "                <tr ng-repeat=\"processInfos in containerTop.Processes\">\n" +
    "                    <td ng-repeat=\"processInfo in processInfos track by $index\">{{processInfo}}</td>\n" +
    "                </tr>\n" +
    "                </tbody>\n" +
    "            </table>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "</div>");
}]);

angular.module("app/components/containers/containers.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("app/components/containers/containers.html",
    "\n" +
    "<h2>Containers:</h2>\n" +
    "\n" +
    "<div>\n" +
    "    <ul class=\"nav nav-pills pull-left\">\n" +
    "        <li class=\"dropdown\">\n" +
    "            <a class=\"dropdown-toggle\" id=\"drop4\" role=\"button\" data-toggle=\"dropdown\" data-target=\"#\">Actions <b class=\"caret\"></b></a>\n" +
    "            <ul id=\"menu1\" class=\"dropdown-menu\" role=\"menu\" aria-labelledby=\"drop4\">\n" +
    "                <li><a tabindex=\"-1\" href=\"\" ng-click=\"startAction()\">Start</a></li>\n" +
    "                <li><a tabindex=\"-1\" href=\"\" ng-click=\"stopAction()\">Stop</a></li>\n" +
    "                <li><a tabindex=\"-1\" href=\"\" ng-click=\"restartAction()\">Restart</a></li>\n" +
    "                <li><a tabindex=\"-1\" href=\"\" ng-click=\"killAction()\">Kill</a></li>\n" +
    "                <li><a tabindex=\"-1\" href=\"\" ng-click=\"pauseAction()\">Pause</a></li>\n" +
    "                <li><a tabindex=\"-1\" href=\"\" ng-click=\"unpauseAction()\">Unpause</a></li>\n" +
    "                <li><a tabindex=\"-1\" href=\"\" ng-click=\"removeAction()\">Remove</a></li>\n" +
    "            </ul>\n" +
    "        </li>\n" +
    "    </ul>\n" +
    "\n" +
    "    <div class=\"pull-right form-inline\">\n" +
    "        <input type=\"checkbox\" ng-model=\"displayAll\" id=\"displayAll\" ng-change=\"toggleGetAll()\"/> <label for=\"displayAll\">Display All</label>&nbsp;\n" +
    "        <input type=\"text\" class=\"form-control\" style=\"vertical-align: center\" id=\"filter\" placeholder=\"Filter\" ng-model=\"filter\"/> <label class=\"sr-only\" for=\"filter\">Filter</label>\n" +
    "    </div>\n" +
    "</div>\n" +
    "<table class=\"table table-striped\">\n" +
    "    <thead>\n" +
    "        <tr>\n" +
    "            <th><label><input type=\"checkbox\" ng-model=\"toggle\" ng-change=\"toggleSelectAll()\" /> Select</label></th>\n" +
    "            <th>\n" +
    "                <a href=\"#/containers/\" ng-click=\"order('Names')\">\n" +
    "                    Name\n" +
    "                    <span ng-show=\"sortType == 'Names' && !sortReverse\" class=\"glyphicon glyphicon-chevron-down\"></span>\n" +
    "                    <span ng-show=\"sortType == 'Names' && sortReverse\" class=\"glyphicon glyphicon-chevron-up\"></span>\n" +
    "                </a>\n" +
    "            </th>\n" +
    "            <th>\n" +
    "                <a href=\"#/containers/\" ng-click=\"order('Image')\">\n" +
    "                    Image\n" +
    "                    <span ng-show=\"sortType == 'Image' && !sortReverse\" class=\"glyphicon glyphicon-chevron-down\"></span>\n" +
    "                    <span ng-show=\"sortType == 'Image' && sortReverse\" class=\"glyphicon glyphicon-chevron-up\"></span>\n" +
    "                </a>\n" +
    "            </th>\n" +
    "            <th>\n" +
    "                <a href=\"#/containers/\" ng-click=\"order('Command')\">\n" +
    "                    Command\n" +
    "                    <span ng-show=\"sortType == 'Command' && !sortReverse\" class=\"glyphicon glyphicon-chevron-down\"></span>\n" +
    "                    <span ng-show=\"sortType == 'Command' && sortReverse\" class=\"glyphicon glyphicon-chevron-up\"></span>\n" +
    "                </a>\n" +
    "            </th>\n" +
    "            <th>\n" +
    "                <a href=\"#/containers/\" ng-click=\"order('Created')\">\n" +
    "                    Created\n" +
    "                    <span ng-show=\"sortType == 'Created' && !sortReverse\" class=\"glyphicon glyphicon-chevron-down\"></span>\n" +
    "                    <span ng-show=\"sortType == 'Created' && sortReverse\" class=\"glyphicon glyphicon-chevron-up\"></span>\n" +
    "                </a>\n" +
    "            </th>\n" +
    "            <th>\n" +
    "                <a href=\"#/containers/\" ng-click=\"order('Status')\">\n" +
    "                    Status\n" +
    "                    <span ng-show=\"sortType == 'Status' && !sortReverse\" class=\"glyphicon glyphicon-chevron-down\"></span>\n" +
    "                    <span ng-show=\"sortType == 'Status' && sortReverse\" class=\"glyphicon glyphicon-chevron-up\"></span>\n" +
    "                </a>\n" +
    "            </th>\n" +
    "            <th>\n" +
    "                Log\n" +
    "            </th>\n" +
    "        </tr>\n" +
    "    </thead>\n" +
    "    <tbody>\n" +
    "        <tr ng-repeat=\"container in (filteredContainers = ( containers | filter:filter | orderBy:sortType:sortReverse))\">\n" +
    "            <td><input type=\"checkbox\" ng-model=\"container.Checked\" /></td>\n" +
    "            <td><a href=\"#/containers/{{ container.Id }}/\">{{ container|containername}}</a></td>\n" +
    "            <td><a href=\"#/images/{{ container.Image }}/\">{{ container.Image }}</a></td>\n" +
    "            <td>{{ container.Command|truncate:40 }}</td>\n" +
    "            <td>{{ container.Created * 1000 | date: 'yyyy-MM-dd' }}</td>\n" +
    "            <td><span class=\"label label-{{ container.Status|statusbadge }}\">{{ container.Status }}</span></td>\n" +
    "            <td><a href=\"#/containers/{{ container.Id }}/logs\">stdout/stderr</a></td>\n" +
    "        </tr>\n" +
    "    </tbody>\n" +
    "</table>\n" +
    "");
}]);

angular.module("app/components/containersNetwork/containersNetwork.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("app/components/containersNetwork/containersNetwork.html",
    "<div class=\"detail\">\n" +
    "    <h2>Containers Network</h2>\n" +
    "\n" +
    "    <div class=\"row\">\n" +
    "        <div class=\"input-group\">\n" +
    "            <input type=\"text\" ng-model=\"query\" autofocus=\"true\" class=\"form-control\"\n" +
    "                   placeholder=\"Search\" ng-change=\"network.selectContainers(query)\"/>\n" +
    "            <span class=\"input-group-addon\"><span class=\"glyphicon glyphicon-search\"/></span>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "    <div class=\"row\">\n" +
    "        <div class=\"btn-group\">\n" +
    "            <button class=\"btn btn-warning\" ng-click=\"network.hideSelected()\">Hide Selected</button>\n" +
    "            <button class=\"btn btn-info\" ng-click=\"network.showSelectedDownstream()\">Show Selected Downstream</button>\n" +
    "            <button class=\"btn btn-info\" ng-click=\"network.showSelectedUpstream()\">Show Selected Upstream</button>\n" +
    "            <button class=\"btn btn-success\" ng-click=\"network.showAll()\">Show All</button>\n" +
    "        </div>\n" +
    "        <input type=\"checkbox\" ng-model=\"includeStopped\" id=\"includeStopped\" ng-change=\"toggleIncludeStopped()\"/> <label\n" +
    "            for=\"includeStopped\">Include stopped containers</label>\n" +
    "    </div>\n" +
    "    <div class=\"row\">\n" +
    "        <vis-network data=\"network.data\" options=\"network.options\" events=\"network.events\"\n" +
    "                     component=\"network.component\"/>\n" +
    "    </div>\n" +
    "</div>\n" +
    "");
}]);

angular.module("app/components/dashboard/dashboard.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("app/components/dashboard/dashboard.html",
    "<div>\n" +
    "<!--\n" +
    "    <div class=\"row\">\n" +
    "        <div class=\"col-xs-12\" id=\"masthead\" style=\"display:none\">\n" +
    "            <div class=\"jumbotron\">\n" +
    "                <h1>BioIT Core - DockerUI</h1>\n" +
    "                <span><h3>Try our Galaxy server \n" +
    "                <a class=\"btn btn-large btn-success\" href=\"http://146.75.173.35\">Hunter Galaxy</a></h3></span>\n" +
    "\n" +
    "                <p class=\"lead\">The Linux container engine</p>\n" +
    "                <a class=\"btn btn-large btn-success\" href=\"http://docker.io\">Learn more.</a>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "-->\n" +
    "    <div class=\"row\">\n" +
    "        <div class=\"col-xs-12\">\n" +
    "            <aside>\n" +
    "                <h3>All Pipelines</h3>\n" +
    "                <div class=\"pull-right form-inline\" id=\"displayAll_chk\">\n" +
    "                    <input type=\"checkbox\" ng-init=\"Settings.displayAll=true\" ng-model=\"displayAll\" id=\"displayAll\" ng-change=\"toggleGetAll()\" />\n" +
    "                    <label for=\"displayAll\" ng-show=\"\">Display All</label>&nbsp;&nbsp;\n" +
    "                    <!--\n" +
    "                    <i class=\"fa fa-search\"></i>\n" +
    "                    <input type=\"text\" class=\"form-control\" style=\"vertical-align: center\" id=\"filter\" placeholder=\"Filter\" ng-model=\"filter\"/> <label class=\"sr-only\" for=\"filter\">Filter</label>\n" +
    "                    -->\n" +
    "                </div>\n" +
    "                <table class=\"table table-striped\">\n" +
    "                    <thead>\n" +
    "                        <tr>\n" +
    "                            <th>Run / Stop</th>\n" +
    "                            <th id=\"dash_sort_th\" ng-click=\"order('Names[0]')\">Pipeline ID (username)\n" +
    "                            <span class=\"glyphicon sort-icon\" ng-show=\"sortKey=='Names[0]'\" ng-class=\"{'glyphicon-chevron-up':reverse,'glyphicon-chevron-down':!reverse}\"></span></th>\n" +
    "                            <th id=\"dash_sort_th\" ng-click=\"order('Image')\">Pipeline Name\n" +
    "                            <span class=\"glyphicon sort-icon\" ng-show=\"sortKey=='Image'\" ng-class=\"{'glyphicon-chevron-up':reverse,'glyphicon-chevron-down':!reverse}\"></span></th>\n" +
    "                            <th id=\"dash_sort_th\" ng-click=\"order('Created')\">Started\n" +
    "                            <span class=\"glyphicon sort-icon\" ng-show=\"sortKey=='Created'\" ng-class=\"{'glyphicon-chevron-up':reverse,'glyphicon-chevron-down':!reverse}\"></span></th>\n" +
    "                            <th id=\"dash_sort_th\" ng-click=\"order('Status')\">Status\n" +
    "                            <span class=\"glyphicon sort-icon\" ng-show=\"sortKey=='Status'\" ng-class=\"{'glyphicon-chevron-up':reverse,'glyphicon-chevron-down':!reverse}\"></span></th>\n" +
    "                        </tr>\n" +
    "                    </thead>\n" +
    "                    <tbody>\n" +
    "                        <tr ng-repeat=\"container in containers | filter:myFilter | orderBy:sortKey:reverse\">\n" +
    "                            <td><a href='#/containers/{{ container.Id }}/'><span ng-click='start()' class=\"btn btn-{{ container.Status|runstopbtn}} btn-xs\">{{ container.Status|runstopbtn_text }}</span></td>\n" +
    "                            <td>{{ container|containername}}</td>\n" +
    "                            <td>{{ container|reponameOnly }}</td>\n" +
    "                            <td>{{ container|getStartedTime }}</td>\n" +
    "                            <td><span class=\"label label-{{ container.Status|statusbadge }}\">{{ container.Status|dashboard_status }}</span></td>\n" +
    "                            <td>{{ containers|chk_containers }}</td>\n" +
    "                        </tr>\n" +
    "                    </tbody>\n" +
    "               </table>\n" +
    "            </aside>\n" +
    "            <aside style=\"float: left\">\n" +
    "                <div class=\"status_chart_group\">\n" +
    "                    <h3>Status</h3>                    \n" +
    "                    <canvas id=\"containers-chart\" style=\"width:'75%';height:'75%'\">\n" +
    "                        <p class=\"browserupgrade\">You are using an <strong>outdated</strong> browser. Please <a\n" +
    "                                href=\"http://browsehappy.com/\">upgrade your browser</a> to improve your experience.</p>\n" +
    "                    </canvas>\n" +
    "                    <div id=\"chart-legend\" style=\"margin-left:10%\"></div>\n" +
    "                </div>\n" +
    "            </aside>\n" +
    "            <aside style=\"float: left; margin-left: 5%\">\n" +
    "                <div class=\"occupied_ports_group\">\n" +
    "                    <h3>Running Pipelines</h3>\n" +
    "                    <ul id=\"occupied_ports\">\n" +
    "                    </ul>\n" +
    "                </div>\n" +
    "\n" +
    "            </aside>\n" +
    "            <!--\n" +
    "            <aside style=\"float: left; margin-left: 5%\">\n" +
    "                <div class=\"running_pipelines_group\">\n" +
    "                    <h3>Running Pipelines</h3>\n" +
    "                    <ul id=\"occupied_ports\">\n" +
    "                    </ul>\n" +
    "                </div>\n" +
    "\n" +
    "            </aside>\n" +
    "            -->\n" +
    "        </div>\n" +
    "    </div>\n" +
    "<!--\n" +
    "    <div class=\"row\">\n" +
    "        <div class=\"col-xs-12\" id=\"stats\">\n" +
    "            <h4>Containers created</h4>\n" +
    "            <canvas id=\"containers-started-chart\">\n" +
    "                <p class=\"browserupgrade\">You are using an <strong>outdated</strong> browser. Please <a\n" +
    "                        href=\"http://browsehappy.com/\">upgrade your browser</a> to improve your experience.</p>\n" +
    "            </canvas>\n" +
    "            <h4>Images created</h4>\n" +
    "            <canvas id=\"images-created-chart\">\n" +
    "                <p class=\"browserupgrade\">You are using an <strong>outdated</strong> browser. Please <a\n" +
    "                        href=\"http://browsehappy.com/\">upgrade your browser</a> to improve your experience.</p>\n" +
    "            </canvas>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "-->\n" +
    "</div>\n" +
    "\n" +
    "\n" +
    "");
}]);

angular.module("app/components/events/events.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("app/components/events/events.html",
    "<div class=\"row\">\n" +
    "    <div class=\"col-xs-12\">\n" +
    "        <h2>Events</h2>\n" +
    "\n" +
    "        <form class=\"form-inline\">\n" +
    "            <div class=\"form-group\">\n" +
    "                <label for=\"since\">Since:</label>\n" +
    "                <input id=\"since\" type=\"datetime-local\" ng-model=\"model.since\" class=\"form-control\" step=\"any\"/>\n" +
    "            </div>\n" +
    "            <div class=\"form-group\">\n" +
    "                <label for=\"until\">Until:</label>\n" +
    "                <input id=\"until\" type=\"datetime-local\" ng-model=\"model.until\" class=\"form-control\" step=\"any\"/>\n" +
    "            </div>\n" +
    "            <button ng-click=\"updateEvents()\" class=\"btn btn-primary\">Update</button>\n" +
    "        </form>\n" +
    "        <br>\n" +
    "        <table class=\"table\">\n" +
    "            <tbody>\n" +
    "            <tr>\n" +
    "                <th>Event</th>\n" +
    "                <th>From</th>\n" +
    "                <th>ID</th>\n" +
    "                <th>Time</th>\n" +
    "            </tr>\n" +
    "            <tr ng-repeat=\"event in dockerEvents\">\n" +
    "                <td ng-bind=\"event.status\"/>\n" +
    "                <td ng-bind=\"event.from\"/>\n" +
    "                <td ng-bind=\"event.id\"/>\n" +
    "                <td ng-bind=\"event.time * 1000 | date:'yyyy-MM-dd HH:mm:ss'\"/>\n" +
    "            </tr>\n" +
    "            </tbody>\n" +
    "        </table>\n" +
    "    </div>\n" +
    "</div>\n" +
    "");
}]);

angular.module("app/components/footer/statusbar.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("app/components/footer/statusbar.html",
    "<div class=\"container\">\n" +
    "	<div class=\"row\">\n" +
    "		<div class=\"col-xs-12\">\n" +
    "			<footer class=\"navbar navbar-default\">\n" +
    "				<div class=\"container-fluid\">\n" +
    "					<div class=\"navbar-collapse\">\n" +
    "				        <ul class=\"nav navbar-nav\">\n" +
    "				        	<li><a>Docker API Version: <strong>{{ apiVersion }}</strong> UI Version: <strong>{{ uiVersion }}</strong></a></li>\n" +
    "				        </ul>\n" +
    "				        <ul class=\"nav navbar-nav navbar-right\">\n" +
    "				        	<li><a href=\"https://github.com/kevana/ui-for-docker\" target=\"_blank\">UI For Docker</a></li>\n" +
    "				        </ul>\n" +
    "					</div>\n" +
    "				</div>\n" +
    "			</footer>\n" +
    "		</div>\n" +
    "	</div>\n" +
    "</div>");
}]);

angular.module("app/components/image/image.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("app/components/image/image.html",
    "<div ng-include=\"template\" ng-controller=\"StartContainerController\"></div>\n" +
    "\n" +
    "<div class=\"alert alert-error\" id=\"error-message\" style=\"display:none\">\n" +
    "    {{ error }}\n" +
    "</div>\n" +
    "\n" +
    "<div class=\"detail\">\n" +
    "\n" +
    "    <h4>Image: {{ id }}</h4>\n" +
    "\n" +
    "    <div class=\"btn-group detail\">\n" +
    "        <button class=\"btn btn-success\" data-toggle=\"modal\" data-target=\"#create-modal\">Start Container</button>\n" +
    "    </div>\n" +
    "\n" +
    "    <div>\n" +
    "        <h4>Containers created:</h4>\n" +
    "        <canvas id=\"containers-started-chart\" width=\"750\">\n" +
    "            <p class=\"browserupgrade\">You are using an <strong>outdated</strong> browser. Please <a\n" +
    "                    href=\"http://browsehappy.com/\">upgrade your browser</a> to improve your experience.</p>\n" +
    "        </canvas>\n" +
    "    </div>\n" +
    "\n" +
    "    <table class=\"table table-striped\">\n" +
    "        <tbody>\n" +
    "        <tr>\n" +
    "            <td>Tags:</td>\n" +
    "            <td>\n" +
    "                <ul>\n" +
    "                    <li ng-repeat=\"tag in RepoTags\">{{ tag }}\n" +
    "                        <button ng-click=\"removeImage(tag)\" class=\"btn btn-sm btn-danger\">Remove tag</button>\n" +
    "                    </li>\n" +
    "                </ul>\n" +
    "            </td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Created:</td>\n" +
    "            <td>{{ image.Created | date: 'yyyy-MM-dd HH:mm:ss'}}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Parent:</td>\n" +
    "            <td><a href=\"#/images/{{ image.Parent }}/\">{{ image.Parent }}</a></td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Size (Virtual Size):</td>\n" +
    "            <td>{{ image.Size|humansize }} ({{ image.VirtualSize|humansize }})</td>\n" +
    "        </tr>\n" +
    "\n" +
    "        <tr>\n" +
    "            <td>Hostname:</td>\n" +
    "            <td>{{ image.ContainerConfig.Hostname }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>User:</td>\n" +
    "            <td>{{ image.ContainerConfig.User }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Cmd:</td>\n" +
    "            <td>{{ image.ContainerConfig.Cmd }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Volumes:</td>\n" +
    "            <td>{{ image.ContainerConfig.Volumes }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Volumes from:</td>\n" +
    "            <td>{{ image.ContainerConfig.VolumesFrom }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Built with:</td>\n" +
    "            <td>Docker {{ image.DockerVersion }} on {{ image.Os}}, {{ image.Architecture }}</td>\n" +
    "        </tr>\n" +
    "\n" +
    "        </tbody>\n" +
    "    </table>\n" +
    "\n" +
    "    <div class=\"row-fluid\">\n" +
    "        <div class=\"span1\">\n" +
    "            History:\n" +
    "        </div>\n" +
    "        <div class=\"span5\">\n" +
    "            <i class=\"icon-refresh\" style=\"width:32px;height:32px;\" ng-click=\"getHistory()\"></i>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "\n" +
    "    <div class=\"well well-large\">\n" +
    "        <ul>\n" +
    "            <li ng-repeat=\"change in history\">\n" +
    "                <strong>{{ change.Id }}</strong>: Created: {{ change.Created | date: 'yyyy-MM-dd' }} Created by: {{ change.CreatedBy\n" +
    "                }}\n" +
    "            </li>\n" +
    "        </ul>\n" +
    "    </div>\n" +
    "\n" +
    "    <hr/>\n" +
    "\n" +
    "    <div class=\"row-fluid\">\n" +
    "        <form class=\"form-inline\" role=\"form\">\n" +
    "            <fieldset>\n" +
    "                <legend>Tag image</legend>\n" +
    "                <div class=\"form-group\">\n" +
    "                    <label>Tag:</label>\n" +
    "                    <input type=\"text\" placeholder=\"repo\" ng-model=\"tagInfo.repo\" class=\"form-control\">\n" +
    "                    <input type=\"text\" placeholder=\"version\" ng-model=\"tagInfo.version\" class=\"form-control\">\n" +
    "                </div>\n" +
    "                <div class=\"form-group\">\n" +
    "                    <label class=\"checkbox\">\n" +
    "                        <input type=\"checkbox\" ng-model=\"tagInfo.force\" class=\"form-control\"/> Force?\n" +
    "                    </label>\n" +
    "                </div>\n" +
    "                <input type=\"button\" ng-click=\"addTag()\" value=\"Add Tag\" class=\"btn btn-primary\"/>\n" +
    "            </fieldset>\n" +
    "        </form>\n" +
    "    </div>\n" +
    "\n" +
    "    <hr/>\n" +
    "\n" +
    "    <div class=\"btn-remove\">\n" +
    "        <button class=\"btn btn-large btn-block btn-primary btn-danger\" ng-click=\"removeImage(id)\">Remove Image</button>\n" +
    "    </div>\n" +
    "</div>\n" +
    "");
}]);

angular.module("app/components/images/images.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("app/components/images/images.html",
    "<div ng-include=\"template\" ng-controller=\"BuilderController\"></div>\n" +
    "<div ng-include=\"template\" ng-controller=\"PullImageController\"></div>\n" +
    "\n" +
    "<h2>Images:</h2>\n" +
    "\n" +
    "<div>\n" +
    "    <ul class=\"nav nav-pills pull-left\">\n" +
    "        <li class=\"dropdown\">\n" +
    "            <a class=\"dropdown-toggle\" id=\"drop4\" role=\"button\" data-toggle=\"dropdown\" data-target=\"#\">Actions <b class=\"caret\"></b></a>\n" +
    "            <ul id=\"menu1\" class=\"dropdown-menu\" role=\"menu\" aria-labelledby=\"drop4\">\n" +
    "                <li><a tabindex=\"-1\" href=\"\" ng-click=\"removeAction()\">Remove</a></li>\n" +
    "            </ul>\n" +
    "        </li>\n" +
    "        <li><a data-toggle=\"modal\" data-target=\"#pull-modal\" href=\"\">Pull</a></li>\n" +
    "    </ul>\n" +
    "\n" +
    "    <div class=\"pull-right form-inline\">\n" +
    "        <input type=\"text\" class=\"form-control\" id=\"filter\" placeholder=\"Filter\" ng-model=\"filter\"/> <label class=\"sr-only\" for=\"filter\">Filter</label>\n" +
    "    </div>\n" +
    "</div>\n" +
    "<table class=\"table table-striped\">\n" +
    "    <thead>\n" +
    "        <tr>\n" +
    "            <th><label><input type=\"checkbox\" ng-model=\"toggle\" ng-change=\"toggleSelectAll()\" /> Select</label></th>\n" +
    "            <th>\n" +
    "                <a href=\"#/images/\" ng-click=\"order('Id')\">\n" +
    "                    Id\n" +
    "                    <span ng-show=\"sortType == 'Id' && !sortReverse\" class=\"glyphicon glyphicon-chevron-down\"></span>\n" +
    "                    <span ng-show=\"sortType == 'Id' && sortReverse\" class=\"glyphicon glyphicon-chevron-up\"></span>\n" +
    "                </a>\n" +
    "            </th>\n" +
    "            <th>\n" +
    "                <a href=\"#/images/\" ng-click=\"order('RepoTags')\">\n" +
    "                    Repository\n" +
    "                    <span ng-show=\"sortType == 'RepoTags' && !sortReverse\" class=\"glyphicon glyphicon-chevron-down\"></span>\n" +
    "                    <span ng-show=\"sortType == 'RepoTags' && sortReverse\" class=\"glyphicon glyphicon-chevron-up\"></span>\n" +
    "                </a>\n" +
    "            </th>\n" +
    "            <th>\n" +
    "                <a href=\"#/images/\" ng-click=\"order('VirtualSize')\">\n" +
    "                    VirtualSize\n" +
    "                    <span ng-show=\"sortType == 'VirtualSize' && !sortReverse\" class=\"glyphicon glyphicon-chevron-down\"></span>\n" +
    "                    <span ng-show=\"sortType == 'VirtualSize' && sortReverse\" class=\"glyphicon glyphicon-chevron-up\"></span>\n" +
    "                </a>\n" +
    "            </th>\n" +
    "            <th>\n" +
    "                <a href=\"#/images/\" ng-click=\"order('Created')\">\n" +
    "                    Created\n" +
    "                    <span ng-show=\"sortType == 'Created' && !sortReverse\" class=\"glyphicon glyphicon-chevron-down\"></span>\n" +
    "                    <span ng-show=\"sortType == 'Created' && sortReverse\" class=\"glyphicon glyphicon-chevron-up\"></span>\n" +
    "                </a>\n" +
    "            </th>\n" +
    "        </tr>\n" +
    "    </thead>\n" +
    "    <tbody>\n" +
    "        <tr ng-repeat=\"image in (filteredImages = (images | filter:filter | orderBy:sortType:sortReverse))\">\n" +
    "            <td><input type=\"checkbox\" ng-model=\"image.Checked\" /></td>\n" +
    "            <td><a href=\"#/images/{{ image.Id }}/?tag={{ image|repotag }}\">{{ image.Id|truncate:20}}</a></td>\n" +
    "            <td>{{ image|repotag }}</td>\n" +
    "            <td>{{ image.VirtualSize|humansize }}</td>\n" +
    "            <td>{{ image.Created * 1000 | date: 'yyyy-MM-dd' }}</td>\n" +
    "        </tr>\n" +
    "    </tbody>\n" +
    "</table>\n" +
    "");
}]);

angular.module("app/components/info/info.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("app/components/info/info.html",
    "<div class=\"detail\">\n" +
    "    <h2>Docker Information</h2>\n" +
    "\n" +
    "    <div>\n" +
    "        <p class=\"lead\">\n" +
    "            <strong>API Endpoint: </strong>{{ endpoint }}<br/>\n" +
    "            <strong>API Version: </strong>{{ docker.ApiVersion }}<br/>\n" +
    "            <strong>Docker version: </strong>{{ docker.Version }}<br/>\n" +
    "            <strong>Git Commit: </strong>{{ docker.GitCommit }}<br/>\n" +
    "            <strong>Go Version: </strong>{{ docker.GoVersion }}<br/>\n" +
    "        </p>\n" +
    "    </div>\n" +
    "\n" +
    "    <table class=\"table table-striped\">\n" +
    "        <tbody>\n" +
    "        <tr>\n" +
    "            <td>Containers:</td>\n" +
    "            <td>{{ info.Containers }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Images:</td>\n" +
    "            <td>{{ info.Images }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Debug:</td>\n" +
    "            <td>{{ info.Debug }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>CPUs:</td>\n" +
    "            <td>{{ info.NCPU }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Total Memory:</td>\n" +
    "            <td>{{ info.MemTotal|humansize }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Operating System:</td>\n" +
    "            <td>{{ info.OperatingSystem }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Kernel Version:</td>\n" +
    "            <td>{{ info.KernelVersion }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>ID:</td>\n" +
    "            <td>{{ info.ID }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Labels:</td>\n" +
    "            <td>{{ info.Labels }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>File Descriptors:</td>\n" +
    "            <td>{{ info.NFd }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Goroutines:</td>\n" +
    "            <td>{{ info.NGoroutines }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Storage Driver:</td>\n" +
    "            <td>{{ info.Driver }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Storage Driver Status:</td>\n" +
    "            <td>\n" +
    "                <p ng-repeat=\"val in info.DriverStatus\">\n" +
    "                    {{ val[0] }}: {{ val[1] }}\n" +
    "                </p>\n" +
    "            </td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Execution Driver:</td>\n" +
    "            <td>{{ info.ExecutionDriver }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Events:</td>\n" +
    "            <td><a href=\"#/events\">Events</a></td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>IPv4 Forwarding:</td>\n" +
    "            <td>{{ info.IPv4Forwarding }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Index Server Address:</td>\n" +
    "            <td>{{ info.IndexServerAddress }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Init Path:</td>\n" +
    "            <td>{{ info.InitPath }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Docker Root Directory:</td>\n" +
    "            <td>{{ info.DockerRootDir }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Init SHA1</td>\n" +
    "            <td>{{ info.InitSha1 }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Memory Limit:</td>\n" +
    "            <td>{{ info.MemoryLimit }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Swap Limit:</td>\n" +
    "            <td>{{ info.SwapLimit }}</td>\n" +
    "        </tr>\n" +
    "        </tbody>\n" +
    "    </table>\n" +
    "</div>\n" +
    "");
}]);

angular.module("app/components/masthead/masthead.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("app/components/masthead/masthead.html",
    "<div class=\"masthead\">\n" +
    "    <a href=\"#/\"><h3 class=\"text-muted\">BioIt Core</h3></a>\n" +
    "    <ul class=\"nav well\">\n" +
    "        <li><a href=\"#/\" style=\"font-size: 18px\"><img src=\"ico/dashboard.png\" style=\"width: 25px; height: 25px\"></img> Dashboard</a></li>\n" +
    "    </ul>\n" +
    "</div>\n" +
    "\n" +
    "");
}]);

angular.module("app/components/network/network.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("app/components/network/network.html",
    "<div class=\"detail\">\n" +
    "\n" +
    "    <h4>Network: {{ network.Name }}</h4>\n" +
    "\n" +
    "    <table class=\"table table-striped\">\n" +
    "        <tbody>\n" +
    "        <tr>\n" +
    "            <td>Name:</td>\n" +
    "            <td>{{ network.Name }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Id:</td>\n" +
    "            <td>{{ network.Id }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Scope:</td>\n" +
    "            <td>{{ network.Scope }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Driver:</td>\n" +
    "            <td>{{ network.Driver }}</td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>IPAM:</td>\n" +
    "            <td>\n" +
    "                <table class=\"table table-striped\">\n" +
    "                    <tr>\n" +
    "                        <td>Driver:</td>\n" +
    "                        <td>{{ network.IPAM.Driver }}</td>\n" +
    "                    </tr>\n" +
    "                    <tr>\n" +
    "                        <td>Subnet:</td>\n" +
    "                        <td>{{ network.IPAM.Config[0].Subnet }}</td>\n" +
    "                    </tr>\n" +
    "                    <tr>\n" +
    "                        <td>Gateway:</td>\n" +
    "                        <td>{{ network.IPAM.Config[0].Gateway }}</td>\n" +
    "                    </tr>\n" +
    "                </table>\n" +
    "            </td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Containers:</td>\n" +
    "            <td>\n" +
    "                <table class=\"table table-striped\" ng-repeat=\"(Id, container) in network.Containers\">\n" +
    "                    <tr>\n" +
    "                        <td>Id:</td>\n" +
    "                        <td><a href=\"#/containers/{{ Id }}\">{{ Id }}</a></td>\n" +
    "                        <td>\n" +
    "                            <button ng-click=\"disconnect(network.Id, Id)\" class=\"btn btn-danger btn-sm\">\n" +
    "                                Disconnect from network\n" +
    "                            </button>\n" +
    "                        </td>\n" +
    "                    </tr>\n" +
    "                    <tr>\n" +
    "                        <td>EndpointID:</td>\n" +
    "                        <td>{{ container.EndpointID}}</td>\n" +
    "                    </tr>\n" +
    "                    <tr>\n" +
    "                        <td>MacAddress:</td>\n" +
    "                        <td>{{ container.MacAddress}}</td>\n" +
    "                    </tr>\n" +
    "                    <tr>\n" +
    "                        <td>IPv4Address:</td>\n" +
    "                        <td>{{ container.IPv4Address}}</td>\n" +
    "                    </tr>\n" +
    "                    <tr>\n" +
    "                        <td>IPv6Address:</td>\n" +
    "                        <td>{{ container.IPv6Address}}</td>\n" +
    "                    </tr>\n" +
    "                </table>\n" +
    "                <form class=\"form-inline\">\n" +
    "                    <div class=\"form-group\">\n" +
    "                        <label>Container ID:\n" +
    "                            <input ng-model=\"containerId\" placeholder=\"3613f73ba0e4\" class=\"form-control\">\n" +
    "                        </label>\n" +
    "                    </div>\n" +
    "                    <button ng-click=\"connect(network.Id, containerId)\" class=\"btn btn-primary\">\n" +
    "                        Connect\n" +
    "                    </button>\n" +
    "                </form>\n" +
    "            </td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "            <td>Options:</td>\n" +
    "            <td>\n" +
    "                <table role=\"table\" class=\"table table-striped\">\n" +
    "                    <tr>\n" +
    "                        <th>Key</th>\n" +
    "                        <th>Value</th>\n" +
    "                    </tr>\n" +
    "                    <tr ng-repeat=\"(k, v) in network.Options\">\n" +
    "                        <td>{{ k }}</td>\n" +
    "                        <td>{{ v }}</td>\n" +
    "                    </tr>\n" +
    "                </table>\n" +
    "            </td>\n" +
    "        </tr>\n" +
    "        </tbody>\n" +
    "    </table>\n" +
    "\n" +
    "\n" +
    "    <hr/>\n" +
    "\n" +
    "\n" +
    "    <div class=\"btn-remove\">\n" +
    "        <button class=\"btn btn-large btn-block btn-primary btn-danger\" ng-click=\"removeImage(id)\">Remove Network\n" +
    "        </button>\n" +
    "    </div>\n" +
    "</div>");
}]);

angular.module("app/components/networks/networks.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("app/components/networks/networks.html",
    "<h2>Networks:</h2>\n" +
    "\n" +
    "<div>\n" +
    "    <ul class=\"nav nav-pills pull-left\">\n" +
    "        <li class=\"dropdown\">\n" +
    "            <a class=\"dropdown-toggle\" id=\"drop4\" role=\"button\" data-toggle=\"dropdown\" data-target=\"#\">Actions <b\n" +
    "                    class=\"caret\"></b></a>\n" +
    "            <ul id=\"menu1\" class=\"dropdown-menu\" role=\"menu\" aria-labelledby=\"drop4\">\n" +
    "                <li><a tabindex=\"-1\" href=\"\" ng-click=\"removeAction()\">Remove</a></li>\n" +
    "            </ul>\n" +
    "        </li>\n" +
    "    </ul>\n" +
    "\n" +
    "    <div class=\"pull-right form-inline\">\n" +
    "        <input type=\"text\" class=\"form-control\" id=\"filter\" placeholder=\"Filter\" ng-model=\"filter\"/> <label\n" +
    "            class=\"sr-only\" for=\"filter\">Filter</label>\n" +
    "    </div>\n" +
    "</div>\n" +
    "<table class=\"table table-striped\">\n" +
    "    <thead>\n" +
    "    <tr>\n" +
    "        <th><label><input type=\"checkbox\" ng-model=\"toggle\" ng-change=\"toggleSelectAll()\"/> Select</label></th>\n" +
    "        <th>\n" +
    "            <a href=\"#/networks/\" ng-click=\"order('Name')\">\n" +
    "                Name\n" +
    "                <span ng-show=\"sortType == 'Name' && !sortReverse\" class=\"glyphicon glyphicon-chevron-down\"></span>\n" +
    "                <span ng-show=\"sortType == 'Name' && sortReverse\" class=\"glyphicon glyphicon-chevron-up\"></span>\n" +
    "            </a>\n" +
    "        </th>\n" +
    "        <th>\n" +
    "            <a href=\"#/networks/\" ng-click=\"order('Id')\">\n" +
    "                Id\n" +
    "                <span ng-show=\"sortType == 'Id' && !sortReverse\" class=\"glyphicon glyphicon-chevron-down\"></span>\n" +
    "                <span ng-show=\"sortType == 'Id' && sortReverse\" class=\"glyphicon glyphicon-chevron-up\"></span>\n" +
    "            </a>\n" +
    "        </th>\n" +
    "        <th>\n" +
    "            <a href=\"#/networks/\" ng-click=\"order('Scope')\">\n" +
    "                Scope\n" +
    "                <span ng-show=\"sortType == 'Scope' && !sortReverse\" class=\"glyphicon glyphicon-chevron-down\"></span>\n" +
    "                <span ng-show=\"sortType == 'Scope' && sortReverse\" class=\"glyphicon glyphicon-chevron-up\"></span>\n" +
    "            </a>\n" +
    "        </th>\n" +
    "        <th>\n" +
    "            <a href=\"#/networks/\" ng-click=\"order('Driver')\">\n" +
    "                Driver\n" +
    "                <span ng-show=\"sortType == 'Driver' && !sortReverse\" class=\"glyphicon glyphicon-chevron-down\"></span>\n" +
    "                <span ng-show=\"sortType == 'Driver' && sortReverse\" class=\"glyphicon glyphicon-chevron-up\"></span>\n" +
    "            </a>\n" +
    "        </th>\n" +
    "        <th>\n" +
    "            <a href=\"#/networks/\" ng-click=\"order('IPAM.Driver')\">\n" +
    "                IPAM Driver\n" +
    "                <span ng-show=\"sortType == 'IPAM.Driver' && !sortReverse\" class=\"glyphicon glyphicon-chevron-down\"></span>\n" +
    "                <span ng-show=\"sortType == 'IPAM.Driver' && sortReverse\" class=\"glyphicon glyphicon-chevron-up\"></span>\n" +
    "            </a>\n" +
    "        </th>\n" +
    "        <th>\n" +
    "            <a href=\"#/networks/\" ng-click=\"order('IPAM.Config[0].Subnet')\">\n" +
    "                IPAM Subnet\n" +
    "                <span ng-show=\"sortType == 'IPAM.Config[0].Subnet' && !sortReverse\" class=\"glyphicon glyphicon-chevron-down\"></span>\n" +
    "                <span ng-show=\"sortType == 'IPAM.Config[0].Subnet' && sortReverse\" class=\"glyphicon glyphicon-chevron-up\"></span>\n" +
    "            </a>\n" +
    "        </th>\n" +
    "        <th>\n" +
    "            <a href=\"#/networks/\" ng-click=\"order('IPAM.Config[0].Gateway')\">\n" +
    "                IPAM Gateway\n" +
    "                <span ng-show=\"sortType == 'IPAM.Config[0].Gateway' && !sortReverse\" class=\"glyphicon glyphicon-chevron-down\"></span>\n" +
    "                <span ng-show=\"sortType == 'IPAM.Config[0].Gateway' && sortReverse\" class=\"glyphicon glyphicon-chevron-up\"></span>\n" +
    "            </a>\n" +
    "        </th>\n" +
    "    </tr>\n" +
    "    </thead>\n" +
    "    <tbody>\n" +
    "    <tr ng-repeat=\"network in ( filteredNetworks = (networks | filter:filter | orderBy:sortType:sortReverse))\">\n" +
    "        <td><input type=\"checkbox\" ng-model=\"network.Checked\"/></td>\n" +
    "        <td><a href=\"#/networks/{{ network.Id }}/\">{{ network.Name|truncate:20}}</a></td>\n" +
    "        <td>{{ network.Id }}</td>\n" +
    "        <td>{{ network.Scope }}</td>\n" +
    "        <td>{{ network.Driver }}</td>\n" +
    "        <td>{{ network.IPAM.Driver }}</td>\n" +
    "        <td>{{ network.IPAM.Config[0].Subnet }}</td>\n" +
    "        <td>{{ network.IPAM.Config[0].Gateway }}</td>\n" +
    "    </tr>\n" +
    "    </tbody>\n" +
    "</table>\n" +
    "<div class=\"row\">\n" +
    "    <div class=\"col-xs-offset-3 col-xs-6\">\n" +
    "        <form role=\"form\" class=\"\">\n" +
    "            <div class=\"form-group\">\n" +
    "                <label>Name:</label>\n" +
    "                <input type=\"text\" placeholder='isolated_nw'\n" +
    "                       ng-model=\"createNetworkConfig.Name\" class=\"form-control\"/>\n" +
    "            </div>\n" +
    "            <div class=\"form-group\">\n" +
    "                <label>Driver:</label>\n" +
    "                <input type=\"text\" placeholder='bridge'\n" +
    "                       ng-model=\"createNetworkConfig.Driver\" class=\"form-control\"/>\n" +
    "            </div>\n" +
    "            <div class=\"form-group\">\n" +
    "                <label>Subnet:</label>\n" +
    "                <input type=\"text\" placeholder='172.20.0.0/16'\n" +
    "                       ng-model=\"createNetworkConfig.IPAM.Config[0].Subnet\" class=\"form-control\"/>\n" +
    "            </div>\n" +
    "            <div class=\"form-group\">\n" +
    "                <label>IPRange:</label>\n" +
    "                <input type=\"text\" placeholder='172.20.10.0/24'\n" +
    "                       ng-model=\"createNetworkConfig.IPAM.Config[0].IPRange\" class=\"form-control\"/>\n" +
    "            </div>\n" +
    "            <div class=\"form-group\">\n" +
    "                <label>Gateway:</label>\n" +
    "                <input type=\"text\" placeholder='172.20.10.11'\n" +
    "                       ng-model=\"createNetworkConfig.IPAM.Config[0].Gateway\" class=\"form-control\"/>\n" +
    "            </div>\n" +
    "            <button type=\"button\" class=\"btn btn-success btn-sm\"\n" +
    "                    ng-click=\"addNetwork(createNetworkConfig)\">\n" +
    "                Create Network\n" +
    "            </button>\n" +
    "        </form>\n" +
    "    </div>\n" +
    "</div>");
}]);

angular.module("app/components/pullImage/pullImage.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("app/components/pullImage/pullImage.html",
    "<div id=\"pull-modal\" class=\"modal fade\">\n" +
    "    <div class=\"modal-dialog\">\n" +
    "        <div class=\"modal-content\">\n" +
    "            <div class=\"modal-header\">\n" +
    "                <button type=\"button\" class=\"close\" data-dismiss=\"modal\" aria-hidden=\"true\">&times;</button>\n" +
    "                <h3>Pull Image</h3>\n" +
    "            </div>\n" +
    "            <div class=\"modal-body\">\n" +
    "                <form novalidate role=\"form\" name=\"pullForm\">\n" +
    "                    <div class=\"form-group\">\n" +
    "                        <label>Registry:</label>\n" +
    "                        <input type=\"text\" ng-model=\"config.registry\" class=\"form-control\"\n" +
    "                               placeholder=\"Registry. Leave empty to user docker hub\"/>\n" +
    "                    </div>\n" +
    "                    <div class=\"form-group\">\n" +
    "                        <label>Image Name:</label>\n" +
    "                        <input type=\"text\" ng-model=\"config.fromImage\" class=\"form-control\" placeholder=\"Image name\"\n" +
    "                               required/>\n" +
    "                    </div>\n" +
    "                    <div class=\"form-group\">\n" +
    "                        <label>Tag Name:</label>\n" +
    "                        <input type=\"text\" ng-model=\"config.tag\" class=\"form-control\"\n" +
    "                               placeholder=\"Tag name. If empty it will download ALL tags.\"/>\n" +
    "                    </div>\n" +
    "                </form>\n" +
    "            </div>\n" +
    "            <div class=\"alert alert-error\" id=\"error-message\" style=\"display:none\">\n" +
    "                {{ error }}\n" +
    "            </div>\n" +
    "            <div class=\"modal-footer\">\n" +
    "                <a href=\"\" class=\"btn btn-primary\" ng-click=\"pull()\">Pull</a>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "</div>\n" +
    "");
}]);

angular.module("app/components/sidebar/sidebar.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("app/components/sidebar/sidebar.html",
    "<div class=\"well\">\n" +
    "    <strong>Running containers:</strong>\n" +
    "    <br/>\n" +
    "    <strong>Endpoint: </strong>{{ endpoint }}\n" +
    "    <ul>\n" +
    "        <li ng-repeat=\"container in containers\">\n" +
    "            <a href=\"#/containers/{{ container.Id }}/\">{{ container.Id|truncate:20 }}</a>\n" +
    "            <span class=\"pull-right label label-{{ container.Status|statusbadge }}\">{{ container.Status }}</span>\n" +
    "        </li>\n" +
    "    </ul>\n" +
    "</div> \n" +
    "");
}]);

angular.module("app/components/startContainer/startcontainer.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("app/components/startContainer/startcontainer.html",
    "<div id=\"create-modal\" class=\"modal fade\">\n" +
    "    <div class=\"modal-dialog\">\n" +
    "        <div class=\"modal-content\">\n" +
    "            <div class=\"modal-header\">\n" +
    "                <button type=\"button\" class=\"close\" data-dismiss=\"modal\" aria-hidden=\"true\">&times;</button>\n" +
    "                <h3>Create And Start Container From Image</h3>\n" +
    "            </div>\n" +
    "            <div class=\"modal-body\">\n" +
    "                <form role=\"form\">\n" +
    "                    <accordion close-others=\"true\">\n" +
    "                        <accordion-group heading=\"Container options\" is-open=\"menuStatus.containerOpen\">\n" +
    "                            <fieldset>\n" +
    "                                <div class=\"row\">\n" +
    "                                    <div class=\"col-xs-6\">\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label>Cmd:</label>\n" +
    "                                            <input type=\"text\" placeholder='[\"/bin/echo\", \"Hello world\"]'\n" +
    "                                                   ng-model=\"config.Cmd\" class=\"form-control\"/>\n" +
    "                                            <small>Input commands as a raw string or JSON array</small>\n" +
    "                                        </div>\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label>Entrypoint:</label>\n" +
    "                                            <input type=\"text\" ng-model=\"config.Entrypoint\" class=\"form-control\"\n" +
    "                                                   placeholder=\"./entrypoint.sh\"/>\n" +
    "                                        </div>\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label>Name:</label>\n" +
    "                                            <input type=\"text\" ng-model=\"config.name\" class=\"form-control\"/>\n" +
    "                                        </div>\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label>Hostname:</label>\n" +
    "                                            <input type=\"text\" ng-model=\"config.Hostname\" class=\"form-control\"/>\n" +
    "                                        </div>\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label>Domainname:</label>\n" +
    "                                            <input type=\"text\" ng-model=\"config.Domainname\" class=\"form-control\"/>\n" +
    "                                        </div>\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label>User:</label>\n" +
    "                                            <input type=\"text\" ng-model=\"config.User\" class=\"form-control\"/>\n" +
    "                                        </div>\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label>Memory:</label>\n" +
    "                                            <input type=\"number\" ng-model=\"config.Memory\" class=\"form-control\"/>\n" +
    "                                        </div>\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label>Volumes:</label>\n" +
    "\n" +
    "                                            <div ng-repeat=\"volume in config.Volumes\">\n" +
    "                                                <div class=\"form-group form-inline\">\n" +
    "                                                    <input type=\"text\" ng-model=\"volume.name\" class=\"form-control\"\n" +
    "                                                           placeholder=\"/var/data\"/>\n" +
    "                                                    <button type=\"button\" class=\"btn btn-danger btn-sm\"\n" +
    "                                                            ng-click=\"rmEntry(config.Volumes, volume)\">Remove\n" +
    "                                                    </button>\n" +
    "                                                </div>\n" +
    "                                            </div>\n" +
    "                                            <button type=\"button\" class=\"btn btn-success btn-sm\"\n" +
    "                                                    ng-click=\"addEntry(config.Volumes, {name: ''})\">Add Volume\n" +
    "                                            </button>\n" +
    "                                        </div>\n" +
    "                                    </div>\n" +
    "                                    <div class=\"col-xs-6\">\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label>MemorySwap:</label>\n" +
    "                                            <input type=\"number\" ng-model=\"config.MemorySwap\" class=\"form-control\"/>\n" +
    "                                        </div>\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label>CpuShares:</label>\n" +
    "                                            <input type=\"number\" ng-model=\"config.CpuShares\" class=\"form-control\"/>\n" +
    "                                        </div>\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label>Cpuset:</label>\n" +
    "                                            <input type=\"text\" ng-model=\"config.Cpuset\" class=\"form-control\"\n" +
    "                                                   placeholder=\"1,2\"/>\n" +
    "                                            <small>Input as comma-separated list of numbers</small>\n" +
    "                                        </div>\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label>WorkingDir:</label>\n" +
    "                                            <input type=\"text\" ng-model=\"config.WorkingDir\" class=\"form-control\"\n" +
    "                                                   placeholder=\"/app\"/>\n" +
    "                                        </div>\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label>MacAddress:</label>\n" +
    "                                            <input type=\"text\" ng-model=\"config.MacAddress\" class=\"form-control\"\n" +
    "                                                   placeholder=\"12:34:56:78:9a:bc\"/>\n" +
    "                                        </div>\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label for=\"networkDisabled\">NetworkDisabled:</label>\n" +
    "                                            <input id=\"networkDisabled\" type=\"checkbox\"\n" +
    "                                                   ng-model=\"config.NetworkDisabled\"/>\n" +
    "                                        </div>\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label for=\"tty\">Tty:</label>\n" +
    "                                            <input id=\"tty\" type=\"checkbox\" ng-model=\"config.Tty\"/>\n" +
    "                                        </div>\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label for=\"openStdin\">OpenStdin:</label>\n" +
    "                                            <input id=\"openStdin\" type=\"checkbox\" ng-model=\"config.OpenStdin\"/>\n" +
    "                                        </div>\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label for=\"stdinOnce\">StdinOnce:</label>\n" +
    "                                            <input id=\"stdinOnce\" type=\"checkbox\" ng-model=\"config.StdinOnce\"/>\n" +
    "                                        </div>\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label>SecurityOpts:</label>\n" +
    "\n" +
    "                                            <div ng-repeat=\"opt in config.SecurityOpts\">\n" +
    "                                                <div class=\"form-group form-inline\">\n" +
    "                                                    <input type=\"text\" ng-model=\"opt.name\" class=\"form-control\"\n" +
    "                                                           placeholder=\"label:type:svirt_apache\"/>\n" +
    "                                                    <button type=\"button\" class=\"btn btn-danger btn-sm\"\n" +
    "                                                            ng-click=\"rmEntry(config.SecurityOpts, opt)\">Remove\n" +
    "                                                    </button>\n" +
    "                                                </div>\n" +
    "                                            </div>\n" +
    "                                            <button type=\"button\" class=\"btn btn-success btn-sm\"\n" +
    "                                                    ng-click=\"addEntry(config.SecurityOpts, {name: ''})\">Add Option\n" +
    "                                            </button>\n" +
    "                                        </div>\n" +
    "                                    </div>\n" +
    "                                </div>\n" +
    "                                <hr>\n" +
    "                                <div class=\"form-group\">\n" +
    "                                    <label>Env:</label>\n" +
    "\n" +
    "                                    <div ng-repeat=\"envar in config.Env\">\n" +
    "                                        <div class=\"form-group form-inline\">\n" +
    "                                            <div class=\"form-group\">\n" +
    "                                                <label class=\"sr-only\">Variable Name:</label>\n" +
    "                                                <input type=\"text\" ng-model=\"envar.name\" class=\"form-control\"\n" +
    "                                                       placeholder=\"NAME\"/>\n" +
    "                                            </div>\n" +
    "                                            <div class=\"form-group\">\n" +
    "                                                <label class=\"sr-only\">Variable Value:</label>\n" +
    "                                                <input type=\"text\" ng-model=\"envar.value\" class=\"form-control\"\n" +
    "                                                       placeholder=\"value\"/>\n" +
    "                                            </div>\n" +
    "                                            <div class=\"form-group\">\n" +
    "                                                <button class=\"btn btn-danger btn-xs form-control\"\n" +
    "                                                        ng-click=\"rmEntry(config.Env, envar)\">Remove\n" +
    "                                                </button>\n" +
    "                                            </div>\n" +
    "                                        </div>\n" +
    "                                    </div>\n" +
    "                                    <button type=\"button\" class=\"btn btn-success btn-sm\"\n" +
    "                                            ng-click=\"addEntry(config.Env, {name: '', value: ''})\">Add environment\n" +
    "                                        variable\n" +
    "                                    </button>\n" +
    "                                </div>\n" +
    "                                <div class=\"form-group\">\n" +
    "                                    <label>Labels:</label>\n" +
    "\n" +
    "                                    <div ng-repeat=\"label in config.Labels\">\n" +
    "                                        <div class=\"form-group form-inline\">\n" +
    "                                            <div class=\"form-group\">\n" +
    "                                                <label class=\"sr-only\">Key:</label>\n" +
    "                                                <input type=\"text\" ng-model=\"label.key\" class=\"form-control\"\n" +
    "                                                       placeholder=\"key\"/>\n" +
    "                                            </div>\n" +
    "                                            <div class=\"form-group\">\n" +
    "                                                <label class=\"sr-only\">Value:</label>\n" +
    "                                                <input type=\"text\" ng-model=\"label.value\" class=\"form-control\"\n" +
    "                                                       placeholder=\"value\"/>\n" +
    "                                            </div>\n" +
    "                                            <div class=\"form-group\">\n" +
    "                                                <button class=\"btn btn-danger btn-xs form-control\"\n" +
    "                                                        ng-click=\"rmEntry(config.Labels, label)\">Remove\n" +
    "                                                </button>\n" +
    "                                            </div>\n" +
    "                                        </div>\n" +
    "                                    </div>\n" +
    "                                    <button type=\"button\" class=\"btn btn-success btn-sm\"\n" +
    "                                            ng-click=\"addEntry(config.Labels, {key: '', value: ''})\">Add Label\n" +
    "                                    </button>\n" +
    "                                </div>\n" +
    "                            </fieldset>\n" +
    "                        </accordion-group>\n" +
    "                        <accordion-group heading=\"HostConfig options\" is-open=\"menuStatus.hostConfigOpen\">\n" +
    "                            <fieldset>\n" +
    "                                <div class=\"row\">\n" +
    "                                    <div class=\"col-xs-6\">\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label>Binds:</label>\n" +
    "\n" +
    "                                            <div ng-repeat=\"bind in config.HostConfig.Binds\">\n" +
    "                                                <div class=\"form-group form-inline\">\n" +
    "                                                    <input type=\"text\" ng-model=\"bind.name\" class=\"form-control\"\n" +
    "                                                           placeholder=\"/host:/container\"/>\n" +
    "                                                    <button type=\"button\" class=\"btn btn-danger btn-sm\"\n" +
    "                                                            ng-click=\"rmEntry(config.HostConfig.Binds, bind)\">Remove\n" +
    "                                                    </button>\n" +
    "                                                </div>\n" +
    "                                            </div>\n" +
    "                                            <button type=\"button\" class=\"btn btn-success btn-sm\"\n" +
    "                                                    ng-click=\"addEntry(config.HostConfig.Binds, {name: ''})\">Add Bind\n" +
    "                                            </button>\n" +
    "                                        </div>\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label>Links:</label>\n" +
    "\n" +
    "                                            <div ng-repeat=\"link in config.HostConfig.Links\">\n" +
    "                                                <div class=\"form-group form-inline\">\n" +
    "                                                    <input type=\"text\" ng-model=\"link.name\" class=\"form-control\"\n" +
    "                                                           placeholder=\"web:db\">\n" +
    "                                                    <button type=\"button\" class=\"btn btn-danger btn-sm\"\n" +
    "                                                            ng-click=\"rmEntry(config.HostConfig.Links, link)\">Remove\n" +
    "                                                    </button>\n" +
    "                                                </div>\n" +
    "                                            </div>\n" +
    "                                            <button type=\"button\" class=\"btn btn-success btn-sm\"\n" +
    "                                                    ng-click=\"addEntry(config.HostConfig.Links, {name: ''})\">Add Link\n" +
    "                                            </button>\n" +
    "                                        </div>\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label>Dns:</label>\n" +
    "\n" +
    "                                            <div ng-repeat=\"entry in config.HostConfig.Dns\">\n" +
    "                                                <div class=\"form-group form-inline\">\n" +
    "                                                    <input type=\"text\" ng-model=\"entry.name\" class=\"form-control\"\n" +
    "                                                           placeholder=\"8.8.8.8\"/>\n" +
    "                                                    <button type=\"button\" class=\"btn btn-danger btn-sm\"\n" +
    "                                                            ng-click=\"rmEntry(config.HostConfig.Dns, entry)\">Remove\n" +
    "                                                    </button>\n" +
    "                                                </div>\n" +
    "                                            </div>\n" +
    "                                            <button type=\"button\" class=\"btn btn-success btn-sm\"\n" +
    "                                                    ng-click=\"addEntry(config.HostConfig.Dns, {name: ''})\">Add entry\n" +
    "                                            </button>\n" +
    "                                        </div>\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label>DnsSearch:</label>\n" +
    "\n" +
    "                                            <div ng-repeat=\"entry in config.HostConfig.DnsSearch\">\n" +
    "                                                <div class=\"form-group form-inline\">\n" +
    "                                                    <input type=\"text\" ng-model=\"entry.name\" class=\"form-control\"\n" +
    "                                                           placeholder=\"example.com\"/>\n" +
    "                                                    <button type=\"button\" class=\"btn btn-danger btn-sm\"\n" +
    "                                                            ng-click=\"rmEntry(config.HostConfig.DnsSearch, entry)\">\n" +
    "                                                        Remove\n" +
    "                                                    </button>\n" +
    "                                                </div>\n" +
    "                                            </div>\n" +
    "                                            <button type=\"button\" class=\"btn btn-success btn-sm\"\n" +
    "                                                    ng-click=\"addEntry(config.HostConfig.DnsSearch, {name: ''})\">Add\n" +
    "                                                entry\n" +
    "                                            </button>\n" +
    "                                        </div>\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label>CapAdd:</label>\n" +
    "\n" +
    "                                            <div ng-repeat=\"entry in config.HostConfig.CapAdd\">\n" +
    "                                                <div class=\"form-group form-inline\">\n" +
    "                                                    <input type=\"text\" ng-model=\"entry.name\" class=\"form-control\"\n" +
    "                                                           placeholder=\"cap_sys_admin\"/>\n" +
    "                                                    <button type=\"button\" class=\"btn btn-danger btn-sm\"\n" +
    "                                                            ng-click=\"rmEntry(config.HostConfig.CapAdd, entry)\">Remove\n" +
    "                                                    </button>\n" +
    "                                                </div>\n" +
    "                                            </div>\n" +
    "                                            <button type=\"button\" class=\"btn btn-success btn-sm\"\n" +
    "                                                    ng-click=\"addEntry(config.HostConfig.CapAdd, {name: ''})\">Add entry\n" +
    "                                            </button>\n" +
    "                                        </div>\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label>CapDrop:</label>\n" +
    "\n" +
    "                                            <div ng-repeat=\"entry in config.HostConfig.CapDrop\">\n" +
    "                                                <div class=\"form-group form-inline\">\n" +
    "                                                    <input type=\"text\" ng-model=\"entry.name\" class=\"form-control\"\n" +
    "                                                           placeholder=\"cap_sys_admin\"/>\n" +
    "                                                    <button type=\"button\" class=\"btn btn-danger btn-sm\"\n" +
    "                                                            ng-click=\"rmEntry(config.HostConfig.CapDrop, entry)\">Remove\n" +
    "                                                    </button>\n" +
    "                                                </div>\n" +
    "                                            </div>\n" +
    "                                            <button type=\"button\" class=\"btn btn-success btn-sm\"\n" +
    "                                                    ng-click=\"addEntry(config.HostConfig.CapDrop, {name: ''})\">Add entry\n" +
    "                                            </button>\n" +
    "                                        </div>\n" +
    "                                    </div>\n" +
    "                                    <div class=\"col-xs-6\">\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label>NetworkMode:</label>\n" +
    "                                            <input type=\"text\" ng-model=\"config.HostConfig.NetworkMode\"\n" +
    "                                                   class=\"form-control\" placeholder=\"bridge\"/>\n" +
    "                                        </div>\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label for=\"publishAllPorts\">PublishAllPorts:</label>\n" +
    "                                            <input id=\"publishAllPorts\" type=\"checkbox\"\n" +
    "                                                   ng-model=\"config.HostConfig.PublishAllPorts\"/>\n" +
    "                                        </div>\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label for=\"privileged\">Privileged:</label>\n" +
    "                                            <input id=\"privileged\" type=\"checkbox\"\n" +
    "                                                   ng-model=\"config.HostConfig.Privileged\"/>\n" +
    "                                        </div>\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label>VolumesFrom:</label>\n" +
    "\n" +
    "                                            <div ng-repeat=\"volume in config.HostConfig.VolumesFrom\">\n" +
    "                                                <div class=\"form-group form-inline\">\n" +
    "                                                    <select ng-model=\"volume.name\"\n" +
    "                                                            ng-options=\"name for name in containerNames track by name\"\n" +
    "                                                            class=\"form-control\">\n" +
    "                                                    </select>\n" +
    "                                                    <button class=\"btn btn-danger btn-xs form-control\"\n" +
    "                                                            ng-click=\"rmEntry(config.HostConfig.VolumesFrom, volume)\">\n" +
    "                                                        Remove\n" +
    "                                                    </button>\n" +
    "                                                </div>\n" +
    "                                            </div>\n" +
    "                                            <button type=\"button\" class=\"btn btn-success btn-sm\"\n" +
    "                                                    ng-click=\"addEntry(config.HostConfig.VolumesFrom, {name: ''})\">Add\n" +
    "                                                volume\n" +
    "                                            </button>\n" +
    "                                        </div>\n" +
    "\n" +
    "                                        <div class=\"form-group\">\n" +
    "                                            <label>RestartPolicy:</label>\n" +
    "                                            <select ng-model=\"config.HostConfig.RestartPolicy.name\">\n" +
    "                                                <option value=\"\">disabled</option>\n" +
    "                                                <option value=\"always\">always</option>\n" +
    "                                                <option value=\"on-failure\">on-failure</option>\n" +
    "                                            </select>\n" +
    "                                            <label>MaximumRetryCount:</label>\n" +
    "                                            <input type=\"number\"\n" +
    "                                                   ng-model=\"config.HostConfig.RestartPolicy.MaximumRetryCount\"/>\n" +
    "                                        </div>\n" +
    "                                    </div>\n" +
    "                                </div>\n" +
    "                                <hr>\n" +
    "                                <div class=\"form-group\">\n" +
    "                                    <label>ExtraHosts:</label>\n" +
    "\n" +
    "                                    <div ng-repeat=\"entry in config.HostConfig.ExtraHosts\">\n" +
    "                                        <div class=\"form-group form-inline\">\n" +
    "                                            <div class=\"form-group\">\n" +
    "                                                <label class=\"sr-only\">Hostname:</label>\n" +
    "                                                <input type=\"text\" ng-model=\"entry.host\" class=\"form-control\"\n" +
    "                                                       placeholder=\"hostname\"/>\n" +
    "                                            </div>\n" +
    "                                            <div class=\"form-group\">\n" +
    "                                                <label class=\"sr-only\">IP Address:</label>\n" +
    "                                                <input type=\"text\" ng-model=\"entry.ip\" class=\"form-control\"\n" +
    "                                                       placeholder=\"127.0.0.1\"/>\n" +
    "                                            </div>\n" +
    "                                            <div class=\"form-group\">\n" +
    "                                                <button class=\"btn btn-danger btn-xs form-control\"\n" +
    "                                                        ng-click=\"rmEntry(config.HostConfig.ExtraHosts, entry)\">Remove\n" +
    "                                                </button>\n" +
    "                                            </div>\n" +
    "                                        </div>\n" +
    "                                    </div>\n" +
    "                                    <button type=\"button\" class=\"btn btn-success btn-sm\"\n" +
    "                                            ng-click=\"addEntry(config.HostConfig.ExtraHosts, {host: '', ip: ''})\">Add\n" +
    "                                        extra host\n" +
    "                                    </button>\n" +
    "                                </div>\n" +
    "                                <div class=\"form-group\">\n" +
    "                                    <label>LxcConf:</label>\n" +
    "\n" +
    "                                    <div ng-repeat=\"entry in config.HostConfig.LxcConf\">\n" +
    "                                        <div class=\"form-group form-inline\">\n" +
    "                                            <div class=\"form-group\">\n" +
    "                                                <label class=\"sr-only\">Name:</label>\n" +
    "                                                <input type=\"text\" ng-model=\"entry.name\" class=\"form-control\"\n" +
    "                                                       placeholder=\"lxc.utsname\"/>\n" +
    "                                            </div>\n" +
    "                                            <div class=\"form-group\">\n" +
    "                                                <label class=\"sr-only\">Value:</label>\n" +
    "                                                <input type=\"text\" ng-model=\"entry.value\" class=\"form-control\"\n" +
    "                                                       placeholder=\"docker\"/>\n" +
    "                                            </div>\n" +
    "                                            <div class=\"form-group\">\n" +
    "                                                <button class=\"btn btn-danger btn-xs form-control\"\n" +
    "                                                        ng-click=\"rmEntry(config.HostConfig.LxcConf, entry)\">Remove\n" +
    "                                                </button>\n" +
    "                                            </div>\n" +
    "                                        </div>\n" +
    "                                    </div>\n" +
    "                                    <button type=\"button\" class=\"btn btn-success btn-sm\"\n" +
    "                                            ng-click=\"addEntry(config.HostConfig.LxcConf, {name: '', value: ''})\">Add\n" +
    "                                        Entry\n" +
    "                                    </button>\n" +
    "                                </div>\n" +
    "                                <div class=\"form-group\">\n" +
    "                                    <label>Devices:</label>\n" +
    "\n" +
    "                                    <div ng-repeat=\"device in config.HostConfig.Devices\">\n" +
    "                                        <div class=\"form-group form-inline inline-four\">\n" +
    "                                            <label class=\"sr-only\">PathOnHost:</label>\n" +
    "                                            <input type=\"text\" ng-model=\"device.PathOnHost\" class=\"form-control\"\n" +
    "                                                   placeholder=\"PathOnHost\"/>\n" +
    "                                            <label class=\"sr-only\">PathInContainer:</label>\n" +
    "                                            <input type=\"text\" ng-model=\"device.PathInContainer\" class=\"form-control\"\n" +
    "                                                   placeholder=\"PathInContainer\"/>\n" +
    "                                            <label class=\"sr-only\">CgroupPermissions:</label>\n" +
    "                                            <input type=\"text\" ng-model=\"device.CgroupPermissions\" class=\"form-control\"\n" +
    "                                                   placeholder=\"CgroupPermissions\"/>\n" +
    "                                            <button class=\"btn btn-danger btn-xs form-control\"\n" +
    "                                                    ng-click=\"rmEntry(config.HostConfig.Devices, device)\">Remove\n" +
    "                                            </button>\n" +
    "                                        </div>\n" +
    "                                    </div>\n" +
    "                                    <button type=\"button\" class=\"btn btn-success btn-sm\"\n" +
    "                                            ng-click=\"addEntry(config.HostConfig.Devices, { PathOnHost: '', PathInContainer: '', CgroupPermissions: ''})\">\n" +
    "                                        Add Device\n" +
    "                                    </button>\n" +
    "                                </div>\n" +
    "                                <div class=\"form-group\">\n" +
    "                                    <label>PortBindings:</label>\n" +
    "\n" +
    "                                    <div ng-repeat=\"portBinding in config.HostConfig.PortBindings\">\n" +
    "                                        <div class=\"form-group form-inline inline-four\">\n" +
    "                                            <label class=\"sr-only\">Host IP:</label>\n" +
    "                                            <input type=\"text\" ng-model=\"portBinding.ip\" class=\"form-control\"\n" +
    "                                                   placeholder=\"Host IP Address\"/>\n" +
    "                                            <label class=\"sr-only\">Host Port:</label>\n" +
    "                                            <input type=\"text\" ng-model=\"portBinding.extPort\" class=\"form-control\"\n" +
    "                                                   placeholder=\"Host Port\"/>\n" +
    "                                            <label class=\"sr-only\">Container port:</label>\n" +
    "                                            <input type=\"text\" ng-model=\"portBinding.intPort\" class=\"form-control\"\n" +
    "                                                   placeholder=\"Container Port\"/>\n" +
    "                                            <select ng-model=\"portBinding.protocol\">\n" +
    "                                                <option value=\"\">tcp</option>\n" +
    "                                                <option value=\"udp\">udp</option>\n" +
    "                                            </select>\n" +
    "                                            <button class=\"btn btn-danger btn-xs form-control\"\n" +
    "                                                    ng-click=\"rmEntry(config.HostConfig.PortBindings, portBinding)\">\n" +
    "                                                Remove\n" +
    "                                            </button>\n" +
    "                                        </div>\n" +
    "                                    </div>\n" +
    "                                    <button type=\"button\" class=\"btn btn-success btn-sm\"\n" +
    "                                            ng-click=\"addEntry(config.HostConfig.PortBindings, {ip: '', extPort: '', intPort: ''})\">\n" +
    "                                        Add Port Binding\n" +
    "                                    </button>\n" +
    "                                </div>\n" +
    "                            </fieldset>\n" +
    "                        </accordion-group>\n" +
    "                    </accordion>\n" +
    "                </form>\n" +
    "            </div>\n" +
    "            <div class=\"modal-footer\">\n" +
    "                <a href=\"\" class=\"btn btn-primary btn-lg\" ng-click=\"create()\">Create</a>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "</div>\n" +
    "");
}]);

angular.module("app/components/stats/stats.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("app/components/stats/stats.html",
    "<div class=\"row\">\n" +
    "    <div class=\"col-xs-12\">\n" +
    "        <h1>Stats for: {{ containerName }}</h1>\n" +
    "\n" +
    "        <h2>CPU</h2>\n" +
    "\n" +
    "        <div class=\"row\">\n" +
    "            <div class=\"col-sm-7\">\n" +
    "                <canvas id=\"cpu-stats-chart\" width=\"650\" height=\"300\"></canvas>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "\n" +
    "        <h2>Memory</h2>\n" +
    "\n" +
    "        <div class=\"row\">\n" +
    "            <div class=\"col-sm-7\">\n" +
    "                <canvas id=\"memory-stats-chart\" width=\"650\" height=\"300\"></canvas>\n" +
    "            </div>\n" +
    "            <div class=\"col-sm-offset-1 col-sm-4\">\n" +
    "                <table class=\"table\">\n" +
    "                    <tr>\n" +
    "                        <td>Max usage</td>\n" +
    "                        <td>{{ data.memory_stats.max_usage | humansize }}</td>\n" +
    "                    </tr>\n" +
    "                    <tr>\n" +
    "                        <td>Limit</td>\n" +
    "                        <td>{{ data.memory_stats.limit | humansize }}</td>\n" +
    "                    </tr>\n" +
    "                    <tr>\n" +
    "                        <td>Fail count</td>\n" +
    "                        <td>{{ data.memory_stats.failcnt }}</td>\n" +
    "                    </tr>\n" +
    "                </table>\n" +
    "                <accordion>\n" +
    "                    <accordion-group heading=\"Other stats\">\n" +
    "                        <table class=\"table\">\n" +
    "                            <tr ng-repeat=\"(key, value) in data.memory_stats.stats\">\n" +
    "                                <td>{{ key }}</td>\n" +
    "                                <td>{{ value }}</td>\n" +
    "                            </tr>\n" +
    "                        </table>\n" +
    "                    </accordion-group>\n" +
    "                </accordion>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "\n" +
    "        <h1>Network {{ networkName}}</h1>\n" +
    "        <div class=\"row\">\n" +
    "            <div class=\"col-sm-7\">\n" +
    "                <canvas id=\"network-stats-chart\" width=\"650\" height=\"300\"></canvas>\n" +
    "            </div>\n" +
    "            <div class=\"col-sm-offset-1 col-sm-4\">\n" +
    "                <div id=\"network-legend\" style=\"margin-bottom: 20px;\"></div>\n" +
    "                <accordion>\n" +
    "                    <accordion-group heading=\"Other stats\">\n" +
    "                        <table class=\"table\">\n" +
    "                            <tr ng-repeat=\"(key, value) in data.network\">\n" +
    "                                <td>{{ key }}</td>\n" +
    "                                <td>{{ value }}</td>\n" +
    "                            </tr>\n" +
    "                        </table>\n" +
    "                    </accordion-group>\n" +
    "                </accordion>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "</div>\n" +
    "");
}]);

angular.module("app/components/volumes/volumes.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("app/components/volumes/volumes.html",
    "<h2>Volumes:</h2>\n" +
    "\n" +
    "<div>\n" +
    "    <ul class=\"nav nav-pills pull-left\">\n" +
    "        <li class=\"dropdown\">\n" +
    "            <a class=\"dropdown-toggle\" id=\"drop4\" role=\"button\" data-toggle=\"dropdown\" data-target=\"#\">Actions <b\n" +
    "                    class=\"caret\"></b></a>\n" +
    "            <ul id=\"menu1\" class=\"dropdown-menu\" role=\"menu\" aria-labelledby=\"drop4\">\n" +
    "                <li><a tabindex=\"-1\" href=\"\" ng-click=\"removeAction()\">Remove</a></li>\n" +
    "            </ul>\n" +
    "        </li>\n" +
    "    </ul>\n" +
    "\n" +
    "    <div class=\"pull-right form-inline\">\n" +
    "        <input type=\"text\" class=\"form-control\" id=\"filter\" placeholder=\"Filter\" ng-model=\"filter\"/> <label\n" +
    "            class=\"sr-only\" for=\"filter\">Filter</label>\n" +
    "    </div>\n" +
    "</div>\n" +
    "<table class=\"table table-striped\">\n" +
    "    <thead>\n" +
    "    <tr>\n" +
    "        <th><label><input type=\"checkbox\" ng-model=\"toggle\" ng-change=\"toggleSelectAll()\"/> Select</label></th>\n" +
    "        <th>\n" +
    "            <a href=\"#/volumes/\" ng-click=\"order('Name')\">\n" +
    "                Name\n" +
    "                <span ng-show=\"sortType == 'Name' && !sortReverse\" class=\"glyphicon glyphicon-chevron-down\"></span>\n" +
    "                <span ng-show=\"sortType == 'Name' && sortReverse\" class=\"glyphicon glyphicon-chevron-up\"></span>\n" +
    "            </a>\n" +
    "        </th>\n" +
    "        <th>\n" +
    "            <a href=\"#/volumes/\" ng-click=\"order('Driver')\">\n" +
    "                Driver\n" +
    "                <span ng-show=\"sortType == 'Driver' && !sortReverse\" class=\"glyphicon glyphicon-chevron-down\"></span>\n" +
    "                <span ng-show=\"sortType == 'Driver' && sortReverse\" class=\"glyphicon glyphicon-chevron-up\"></span>\n" +
    "            </a>\n" +
    "        </th>\n" +
    "        <th>\n" +
    "            <a href=\"#/volumes/\" ng-click=\"order('Mountpoint')\">\n" +
    "                Mountpoint\n" +
    "                <span ng-show=\"sortType == 'Mountpoint' && !sortReverse\" class=\"glyphicon glyphicon-chevron-down\"></span>\n" +
    "                <span ng-show=\"sortType == 'Mountpoint' && sortReverse\" class=\"glyphicon glyphicon-chevron-up\"></span>\n" +
    "            </a>\n" +
    "        </th>\n" +
    "    </tr>\n" +
    "    </thead>\n" +
    "    <tbody>\n" +
    "    <tr ng-repeat=\"volume in (filteredVolumes = (volumes | filter:filter | orderBy:sortType:sortReverse))\">\n" +
    "        <td><input type=\"checkbox\" ng-model=\"volume.Checked\"/></td>\n" +
    "        <td>{{ volume.Name|truncate:20 }}</td>\n" +
    "        <td>{{ volume.Driver }}</td>\n" +
    "        <td>{{ volume.Mountpoint }}</td>\n" +
    "    </tr>\n" +
    "    </tbody>\n" +
    "</table>\n" +
    "<div class=\"row\">\n" +
    "    <div class=\"col-xs-offset-3 col-xs-6\">\n" +
    "        <form role=\"form\" class=\"\">\n" +
    "            <div class=\"form-group\">\n" +
    "                <label>Name:</label>\n" +
    "                <input type=\"text\" placeholder='tardis'\n" +
    "                       ng-model=\"createVolumeConfig.Name\" class=\"form-control\"/>\n" +
    "            </div>\n" +
    "            <div class=\"form-group\">\n" +
    "                <label>Driver:</label>\n" +
    "                <input type=\"text\" placeholder='local'\n" +
    "                       ng-model=\"createVolumeConfig.Driver\" class=\"form-control\"/>\n" +
    "            </div>\n" +
    "            <button type=\"button\" class=\"btn btn-success btn-sm\"\n" +
    "                    ng-click=\"addVolume(createVolumeConfig)\">\n" +
    "                Create Volume\n" +
    "            </button>\n" +
    "        </form>\n" +
    "    </div>\n" +
    "</div>");
}]);