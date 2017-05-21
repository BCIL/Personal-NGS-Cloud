angular.module('FileManagerApp', [])
        .controller('FileManagerController', ['$scope', function ($scope, config) {
            var filemanager_loc = 'http://' + window.location.hostname + ':9090'
            $scope.filemanager_info = filemanager_loc            
            document.getElementById('filemanager_frame').src = filemanager_loc
            var buffer = 20; //scroll bar buffer
            var iframe = document.getElementById('filemanager_frame');

            function pageY(elem) {
                return elem.offsetParent ? (elem.offsetTop + pageY(elem.offsetParent)) : elem.offsetTop;
            }

            function resizeIframe() {
                var height = document.documentElement.clientHeight;
                height -= pageY(document.getElementById('filemanager_frame'))+ buffer ;
                height = (height < 0) ? 0 : height;
                document.getElementById('filemanager_frame').style.height = height + 'px';
            }

            // .onload doesn't work with IE8 and older.
            if (iframe.attachEvent) {
                iframe.attachEvent("onload", resizeIframe);
            } else {
                iframe.onload=resizeIframe;
            }

            window.onresize = resizeIframe;
        }])
