angular.module('container', [])
    .controller('ContainerController', ['$scope', '$routeParams', '$location', 'Container', 'ContainerCommit', 'Messages', 'ViewSpinner',
        function ($scope, $routeParams, $location, Container, ContainerCommit, Messages, ViewSpinner) {
            $scope.changes = [];
            $scope.edit = false;

            var update = function () {
                ViewSpinner.spin();
                Container.get({id: $routeParams.id}, function (d) {
                    $scope.container = d;
                    $scope.container.edit = false;
                    $scope.container.newContainerName = '';
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
                $("#galaxy_server_info").append("<li id='galaxy_init_msg_wrapper'><span id='galaxy_init_msg'>Initializing the Galaxy server..<br />&nbsp&nbsp  Please stand by..</span></li>");
                
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
                display_galaxy_init();
                Container.start({
                    id: $scope.container.Id,
                    HostConfig: $scope.container.HostConfig
                }, function (d) {
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
                    Messages.send("Pipeline removed", $routeParams.id);
                }, function (e) {
                    update();
                    Messages.error("Failure", "Pipeline failed to remove." + e.data);
                });
            };

            $scope.restart = function () {
                var user_confirm = confirm("The pipeline will be restarted!\nContinue?");
                if (user_confirm) {
                    ViewSpinner.spin();
                    Container.restart({id: $routeParams.id}, function (d) {
                        update();
                        Messages.send("Pipeline restarted", $routeParams.id);
                    }, function (e) {
                        update();
                        Messages.error("Failure", "Pipeline failed to restart." + e.data);
                    });
                }
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
                        Messages.send("Username updated successfully!", $routeParams.id);
                    } else {
                        $scope.container.newContainerName = $scope.container.Name;
                        Messages.error("Failure!", "Failed to update username.\nPlease check if the username is already taken.");
                    }
                });
                $scope.container.edit = false;
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

