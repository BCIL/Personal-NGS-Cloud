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
    .filter('list_to_str', function () {
        return function (list) {
            return list.toString().replace("/","");
        }
    })
    .filter('get_image_name', function() {
        return function (image) {
            return image.split(':')[1]
        }
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
    })
