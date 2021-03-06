angular.module('dashboard', [])
    .controller('DashboardController', ['$scope', 'Container', '$routeParams', '$location', 'Messages', 'Image', 'Settings', 'LineChart', function ($scope, Container, Image, Settings, LineChart, $routeParams, $location, Messages) {
        $scope.predicate = '-Created';
        $scope.containers = [];
        window.test_routeParams = $routeParams;
        window.test_messages = Messages;

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

        $scope.get_baseInstance = function (container) {
            var inst_name = container.Names[0];
            if ( inst_name.includes('ChIP_Seq_single-end') ) {
                return true
            }
            else if ( inst_name.includes('ChIP_Seq_paired-end') ) {
                return true
            }
            else if ( inst_name.includes('RNA_Seq_paired-end') ) {
                return true
            }
            else { return false }
         }


        $scope.myFilter = function (container) {
            var image_name = container.Image;
            var inst_name = container.Names[0];
            if ( image_name.includes('_dui_') ) {
                if ( inst_name.includes('ChIP_Seq_single-end') ) {
                    return false
                }
                else if ( inst_name.includes('ChIP_Seq_paired-end') ) {
                    return false
                }
                else if ( inst_name.includes('RNA_Seq_paired-end') ) {
                    return false
                }
                else { return true }
            }
            else {
                return false
            }
         }

        $scope.chk_dui = function (container) {
            var image_Names = container.Names;
            var image_Status = container.Status;
            if (image_Status.includes('Up')) {
                return image_Names
            }
        };
        /*
        $scope.remove = function () {
            Container.remove({id: $routeParams.id}, function (d) {
                update();
                $location.path('/#');
                Messages.send("Pipeline removed", $routeParams.id);
            }, function (e) {
                update();
                Messages.error("Failure", "Pipeline failed to remove." + e.data);
            });
        };
        */
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
            if ( image_name.search("RNA_Seq_paired-end") != -1 ) {
                return true;
            }
            else if ( image_name.search("ChIP_Seq_single-end") != -1 ) {
                return true;
            }
            else if ( image_name.search("ChIP_Seq_paired-end") != -1 ) {
                return true;
            }
            else { return false; }
        }

        Container.query({all: 1}, function (d) {
            var created = 0;
            var running = 0;
            var ghost = 0;
            var stopped = 0;
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
                    created += 1;
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
                    color: '#5bb75b',
                    title: 'Ready'
                },
                {
                    value: running,
                    color: '#0129fb',
                    title: 'Running'
                }, // running
                {
                    value: stopped,
                    color: '#C7604C',
                    title: 'Stopped'
                } // stopped
                /*{
                    value: ghost,
                    color: '#E2EAE9',
                    title: 'Ghost'
                } // ghost*/
            ];

            c.Pie(data, opts);
            var lgd = $('#chart-legend').get(0);
            legend(lgd, data);
            window.test_container_port = [];
            setTimeout(function() {
                $("#displayAll").click();
            },300);
/*
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
*/
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
