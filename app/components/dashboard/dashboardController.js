angular.module('dashboard', [])
    .controller('DashboardController', ['$scope','$window', 'Container', 'Image', 'Settings', 'LineChart','ViewSpinner', function ($scope, $window, Container, Image, Settings, LineChart, ViewSpinner) {
        $scope.predicate = '-Created';
        $scope.containers = [];
        var getStarted = function (data) {
            update({all: Settings.displayAll ? 1 : 0});
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

        $scope.start = function () {
                window.test_cont = Container;
                //console.log("start function works")
            /*
                Container.start({
                    id: $scope.container.Id,
                    HostConfig: $scope.container.HostConfig
                }, function (d) {
                    update();
                    Messages.send("Container started", $routeParams.id);
                }, function (e) {
                    update();
                    Messages.error("Failure", "Container failed to start." + e.data);
                });
            */
        };
        //$scope.displayAll = true;
        $scope.myFilter = function (container) {
            var ChIPsequser = "bcil/chip-seq:ChIPsequser_dockerui"
            var RNAsequser_tophat1 = "bcil/rna-seq:RNAsequser_dockerui_tophat1"
            var RNAsequser_tophat2 = "bcil/rna-seq:RNAsequser_dockerui_tophat2"
            return container.Image === ChIPsequser+'_1' || container.Image === ChIPsequser+'_2' ||container.Image === ChIPsequser+'_3' || container.Image === RNAsequser_tophat1+'_1' || container.Image === RNAsequser_tophat1+'_2' || container.Image === RNAsequser_tophat1+'_3' || container.Image === RNAsequser_tophat2+'_1' || container.Image === RNAsequser_tophat2+'_2' || container.Image === RNAsequser_tophat2+'_3' || container.Image === "bcil/gatk:GATKuser1_1" || container.Image === "bcil/gatk:GATKuser1_2" || container.Image === "bcil/gatk:GATKuser1_3" || container.Image === "bcil/gatk:GATKuser2_1"|| container.Image === "bcil/gatk:GATKuser2_1"|| container.Image === "bcil/gatk:GATKuser2_3";
        }

        var opts = {
            animation: false,
            percentageInnerCutout : 0
        };
        if (Settings.firstLoad) {
            opts.animation = true;
            Settings.firstLoad = false;
            $('#masthead').show();

            setTimeout(function () {
                $('#masthead').slideUp('slow');
            }, 5000);
        }
        function valid_pipeline(item){
            var ChIPsequser = "bcil/chip-seq:ChIPsequser_dockerui"
            var RNAsequser_tophat1 = "bcil/rna-seq:RNAsequser_dockerui_tophat1"
            var RNAsequser_tophat2 = "bcil/rna-seq:RNAsequser_dockerui_tophat2"
            if (item.Image === ChIPsequser+'_1' || item.Image === ChIPsequser+'_2' ||item.Image === ChIPsequser+'_3' || item.Image === RNAsequser_tophat1+'_1' || item.Image === RNAsequser_tophat1+'_2' || item.Image === RNAsequser_tophat1+'_3' || item.Image === RNAsequser_tophat2+'_1' || item.Image === RNAsequser_tophat2+'_2' || item.Image === RNAsequser_tophat2+'_3' || item.Image === "bcil/gatk:GATKuser1_1" || item.Image === "bcil/gatk:GATKuser1_2" || item.Image === "bcil/gatk:GATKuser1_3" || item.Image === "bcil/gatk:GATKuser2_1" || item.Image === "bcil/gatk:GATKuser2_2" || item.Image === "bcil/gatk:GATKuser2_3") 
                {
                    test_items.push(item);
                    return true;
                }
            else { return false; }
        }
        Container.query({all: 1}, function (d) {
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

            //getStarted(d);      // generates linecharts
            window.test_scope_cont = $scope.containers;
            var data = [
                {
                    value: running,
                    color: '#40ff00',
                    highlight: '#8cff66',
                    label: 'Running',
                    title: 'Running'
                }, // running
                {
                    value: stopped,
                    color: '#ff3300',
                    highlight: '#ff5c33',
                    label: 'Stopped',
                    title: 'Stopped'
                } // stopped
                /*
                {
                    value: ghost,
                    color: '#a6a6a6',
                    highlight: '#bfbfbf',
                    label: 'Ghost',
                    title: 'Ghost'
                } // ghost
                */
            ];

            var ctx = $('#containers-chart').get(0).getContext("2d")
            var c = new Chart(ctx).Pie(data, opts);
            var lgd = $('#chart-legend').get(0);
            legend(lgd, data);

            setTimeout(function() {
                $("#displayAll").click();
            },300);
            setTimeout(function() {
                'use strict';
                ViewSpinner.spin();
                $('#occupied_ports').empty();
                var ChIPsequser = "bcil/chip-seq:ChIPsequser_dockerui"
                var RNAsequser_tophat1 = "bcil/rna-seq:RNAsequser_dockerui_tophat1"
                var RNAsequser_tophat2 = "bcil/rna-seq:RNAsequser_dockerui_tophat2"
                for (var i=0;i<$scope.containers.length;i++){
                    if ($scope.containers[i].Status[0] === 'U') {
                        var container = $scope.containers[i];
                        if (container.Image === ChIPsequser+'_1' || container.Image === ChIPsequser+'_2' ||container.Image === ChIPsequser+'_3' || container.Image === RNAsequser_tophat1+'_1' || container.Image === RNAsequser_tophat1+'_2' || container.Image === RNAsequser_tophat1+'_3' || container.Image === RNAsequser_tophat2+'_1' || container.Image === RNAsequser_tophat2+'_2' || container.Image === RNAsequser_tophat2+'_3' ||
                            container.Image === "bcil/gatk:GATKuser1_1" ||
                            container.Image === "bcil/gatk:GATKuser1_2" ||
                            container.Image === "bcil/gatk:GATKuser1_3" ||
                            container.Image === "bcil/gatk:GATKuser2_1" ||
                            container.Image === "bcil/gatk:GATKuser2_2" ||
                            container.Image === "bcil/gatk:GATKuser2_3"
                            ) 
                        {
                            var image_name = ($scope.containers[i].Names[0]).replace('/','');
                            var port_info = $scope.containers[i].Ports.Public_port;
                            if (typeof(port_info) === 'undefined') {
                                port_info = 'No broadcasting'
                            }
                            $('#occupied_ports').append('<li>'+image_name+' -> <b>'+port_info+'</b></li>')
                        }
                    }
                }
                ViewSpinner.stop();
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

