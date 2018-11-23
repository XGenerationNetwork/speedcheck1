(function() {

    'use strict';

    var wlNgNST = angular.module('wl-ng-network-speed-tester', []);

    wlNgNST.service('wlNgNSTTimer', [function() {
        return {
            now: function() {
                return new Date().getTime()
            },
            diff: function(startTime) {
                return (this.now() - startTime) / 1000;
            }
        }
    }]);

    wlNgNST.service('wlNgNSTDataGenerator', [function() {
        return {
            generate: function(length) {
                var ret = [];
                for (var i = 0; i < length ; i++) {
                    ret.push('');
                }
                return ret.join();
            }
        }
    }]);

    wlNgNST.service('wlNgNSTComparisonManager', [function() {
        return {
            comparisons: [ //Bps
                {
                    type: 'Ethernet',
                    download: 10240 * 1024 / 8,
                    upload: 10240 * 1024 / 8
                },
                {
                    type: 'Cable',
                    download: 3072 * 1024 / 8,
                    upload: 384 * 1024 / 8
                },
                {
                    type: 'T1',
                    download: 1581 * 1024 / 8,
                    upload: 1581 * 1024 / 8
                },
                {
                    type: 'DSL',
                    download: 256 * 1024 / 8,
                    upload: 256 * 1024 / 8
                },
                {
                    type: 'Dialup',
                    download: 28 * 1024 / 8,
                    upload: 28 * 1024 / 8
                }
            ],
            reset: function() {
                this.resetDownload();
                this.resetUpload();
            },
            resetDownload: function() {
                for(var i = 0; i < this.comparisons.length; i++) {
                    this.comparisons[i].downloadValue = 0;
                }
            },
            resetUpload: function() {
                for(var i = 0; i < this.comparisons.length; i++) {
                    this.comparisons[i].uploadValue = 0;
                }
            },
            refreshDownload: function() {
                for(var i = 0; i < this.comparisons.length; i++) {
                    this.comparisons[i].downloadValue = this.comparisons[i].download;
                }
            },
            refreshUpload: function() {
                for(var i = 0; i < this.comparisons.length; i++) {
                    this.comparisons[i].uploadValue = this.comparisons[i].upload;
                }
            }
        }
    }]);

    wlNgNST.service('wlNgNSTServer', ['$http', '$q', 'bins', 'wlNgNSTTimer', function($http, $q, bins, wlNgNSTTimer) {
        var getServer = function(url) {
            var dfd = $q.defer();
            $http.head(bins + '/' + url)
                .success(function(data, status, headers) {
                    var server = headers('Server');
                    dfd.resolve(server);
                })
                .error(function(data) {
                    dfd.reject(data);
                });
            return dfd.promise;
        };

        var doGet = function(url) {
            var dfd = $q.defer();
            $http.get(bins + '/' + url)
                .success(function(data) {
                    dfd.resolve(data);
                })
                .error(function(data) {
                    dfd.reject(data);
                });
            return dfd.promise;
        };

        var doPost = function(url, data) {
            var dfd = $q.defer();
            $http.post(bins + '/' + url, data)
                .success(function(data) {
                    dfd.resolve(data);
                })
                .error(function(data) {
                    dfd.reject(data);
                });
            return dfd.promise;
        };

        return {
            getServer: function() {
                return getServer('ping.html?id=' + wlNgNSTTimer.now());
            },
            ping: function() {
                return doGet('ping.html?id=' + wlNgNSTTimer.now())
            },
            download: function() {
                return doGet('payload.html?id=' + wlNgNSTTimer.now())
            },
            upload: function(uploadData) {
                return doPost(this.resourceForPost +  '?id=' + wlNgNSTTimer.now(), uploadData)
            },
            resourceForPost: undefined
        };
    }]);

    wlNgNST.service('wlNgNSTService', ['$q', 'wlNgNSTTimer', 'wlNgNSTServer', function($q, wlNgNSTTimer, wlNgNSTServer) {
        return {
            ping: function() {
                var dfd = $q.defer();
                var t0 = wlNgNSTTimer.now();
                wlNgNSTServer.ping()
                    .then(function() {
                        var pingTime = wlNgNSTTimer.diff(t0);
                        dfd.resolve(pingTime);
                    }, function(error) {
                        dfd.reject(error);
                    });
                return dfd.promise;
            },
            download: function() {
                var dfd = $q.defer();
                var t0 = wlNgNSTTimer.now();
                wlNgNSTServer.download()
                    .then(function(data) {
                        var time = wlNgNSTTimer.diff(t0);   //sec
                        var size = data.length;             //bytes
                        dfd.resolve({
                            time: time,
                            size: size,
                            speed: size / time              //B/s
                        });
                    }, function(error) {
                        dfd.reject(error);
                    });
                return dfd.promise;
            },
            upload: function(payloadData) {
                var getResourceForPostByServer = function(server) {
                    if(server) {
                        if(server.indexOf('PHP') !== -1) {
                            return 'ping.php';
                        }else if (server.indexOf('IIS') !== -1) {
                            return 'ping.aspx';
                        }
                    }
                    return 'ping.html';
                };

                var doUpload = function(dfd) {
                    var t0 = wlNgNSTTimer.now();
                    wlNgNSTServer.upload(payloadData)
                        .then(function() {
                            var time = wlNgNSTTimer.diff(t0);   //sec
                            var size = payloadData.length;      //bytes
                            dfd.resolve({
                                time: time,
                                size: size,
                                speed: size / time              //B/s
                            });
                        }, function(error) {
                            dfd.reject(error);
                        });
                };

                var doGetServerAndUpload = function(dfd) {
                    wlNgNSTServer.getServer()
                        .then(function(server) {
                            wlNgNSTServer.resourceForPost = getResourceForPostByServer(server);
                            doUpload(dfd);
                        }, function() {
                            wlNgNSTServer.resourceForPost = 'ping.html';
                            doUpload(dfd);
                        });
                };

                var dfd = $q.defer();
                if(wlNgNSTServer.resourceForPost == null) {
                    doGetServerAndUpload(dfd);
                }else {
                    doUpload(dfd);
                }
                return dfd.promise;
            }
        }
    }]);

    wlNgNST.filter('wlNgNSTCostConverter', [function() {
        return function(cost, mu) {
            switch(mu) {
                case 'bps': return (cost / 8).toFixed(2);
                case 'Bps': return cost.toFixed(2);
                case 'Kbps': return (cost / 8 * 1024).toFixed(2);
                case 'KBps': return (cost * 1024).toFixed(2);
                case 'Mbps': return (cost / 8 * 1024 * 1024).toFixed(2);
                case 'MBps': return (cost * 1024 * 1024).toFixed(2);
                case 'Gbps': return (cost / 8 * 1024 * 1024 * 1024).toFixed(2);
                case 'GBps': return (cost * 1024 * 1024 * 1024).toFixed(2);
                default: return (cost).toFixed(2);
            }
        };
    }]);

    wlNgNST.filter('wlNgNSTUnitConverter', [function() {
        return function(bytes, mu) {
            switch(mu) {
                case 'bps': return (bytes * 8).toFixed(2);
                case 'Bps': return bytes.toFixed(2);
                case 'Kbps': return (bytes * 8 / 1024).toFixed(2);
                case 'KBps': return (bytes / 1024).toFixed(2);
                case 'Mbps': return (bytes * 8 / 1024 / 1024).toFixed(2);
                case 'MBps': return (bytes / 1024 / 1024).toFixed(2);
                case 'Gbps': return (bytes * 8 / 1024 / 1024 / 1024).toFixed(2);
                case 'GBps': return (bytes / 1024 / 1024 / 1024).toFixed(2);
                default: return (bytes).toFixed(2);
            }
        };
    }]);

    wlNgNST.service('wlNgNSTPercentConverter', [function() {
        return function(input, max) {
            return (input * 100 / max).toFixed(2);
        }
    }]);

    wlNgNST.directive('wlNgNetworkSpeedTester', ['$q', '$timeout', 'bins', 'wlNgNSTService', 'wlNgNSTComparisonManager', 'wlNgNSTDataGenerator', 'wlNgNSTPercentConverter', function($q, $timeout, bins, wlNgNSTService, wlNgNSTComparisonManager, wlNgNSTDataGenerator, wlNgNSTPercentConverter) {
        return {
            replace: true,
            restrict: 'A',
            templateUrl: bins + '/wl-ng-network-speed-tester.html',
            scope: {
                autoTrigger: '=?',
                triggerGo: '=',
                showRefreshButton: '=?',
                iterations: '=?',
                showPing: '=?',
                showDownload: '=?',
                showUpload: '=?',
                showComparison: '=?',
                speedMeasureUnit: '=?',
                showCost: '=?',
                unitCostPerByte: '=?',
                localeSeconds:'@',
                localeYou:'@',
                localePing:'@',
                localeDownload:'@',
                localeUpload:'@',
                localeCost:'@',
                localeUnitCost:'@',
                localeTotalCost:'@',
                localeCurrency: '@',
                localeBillingPeriod: '@'
            },
            controller: ['$scope', function($scope) {

                var setDefaultParameters = function() {
                    $scope.speedMeasureUnit = $scope.speedMeasureUnit || 'Mbps';
                    $scope.iterations = $scope.iterations || 10;
                    $scope.localeSeconds = $scope.localeSeconds || 'seconds';
                    $scope.localeYou = $scope.localeYou || 'You';
                    $scope.localePing = $scope.localePing || 'Ping';
                    $scope.localeDownload = $scope.localeDownload || 'Download';
                    $scope.localeUpload = $scope.localeUpload || 'Upload';
                    $scope.localeCost = $scope.localeCost || 'Internet Cost';
                    $scope.localeUnitCost = $scope.localeUnitCost || 'Unit Price';
                    $scope.localeTotalCost = $scope.localeTotalCost || 'Total Amount';
                    $scope.localeCurrency = $scope.localeCurrency || '$';
                    $scope.localeBillingPeriod = $scope.localeBillingPeriod || 'month';

                    $scope.autoTrigger = angular.isDefined($scope.autoTrigger) ? $scope.autoTrigger : true;
                    $scope.showRefreshButton = angular.isDefined($scope.showRefreshButton) ? $scope.showRefreshButton : true;
                    $scope.showPing = angular.isDefined($scope.showPing) ? $scope.showPing : true;
                    $scope.showDownload = angular.isDefined($scope.showDownload) ? $scope.showDownload : true;
                    $scope.showUpload = angular.isDefined($scope.showUpload) ? $scope.showUpload : true;
                    $scope.showCost = angular.isDefined($scope.showCost) ? $scope.showCost : true;
                    $scope.showComparison = angular.isDefined($scope.showComparison) ? $scope.showComparison : true;
                    $scope.unitCostPerByte = angular.isDefined($scope.unitCostPerByte) ? $scope.unitCostPerByte : 20 / 1024 / 1024;
                };
                setDefaultParameters();

                var uploadData = wlNgNSTDataGenerator.generate(102400);
                $scope.comparisons = wlNgNSTComparisonManager.comparisons;
                wlNgNSTComparisonManager.reset($scope.comparisons);

                $scope.vm = {
                    loaderImg: bins + '/working.gif',

                    pingTime: 0,
                    pingIteration: 0,
                    pingInstantTime: 0,

                    downloadSpeed: 0,
                    downloadIteration: 0,
                    downloadInstantSpeed: 0,

                    uploadSpeed: 0,
                    uploadIteration: 0,
                    uploadInstantSpeed: 0
                };

                $scope.$watch('triggerGo', function() {
                    if($scope.triggerGo) {
                        $scope.triggerGo = false;
                        $scope.go();
                    }
                });

                $scope.percent = function(value) {
                    return wlNgNSTPercentConverter(value, $scope.maxSpeed());
                };

                $scope.pingStyle = function() {
                    return {'width' : wlNgNSTPercentConverter($scope.vm.pingIteration, $scope.iterations) + '%'};
                };

                $scope.downloadStyle = function() {
                    var width = 100 * ($scope.vm.downloadActive ? $scope.vm.downloadIteration / $scope.iterations : $scope.vm.downloadSpeed / $scope.maxSpeed());
                    return {'width': width + '%'};
                };

                $scope.uploadStyle = function() {
                    var width = 100 * ($scope.vm.uploadActive ? $scope.vm.uploadIteration / $scope.iterations : $scope.vm.uploadSpeed / $scope.maxSpeed());
                    return {'width': width + '%'};
                };

                $scope.comparisonStyle = function(value) {
                    return {'width': $scope.percent(value) + '%'};
                };

                $scope.maxSpeed = function() {
                    var ret = 0;
                    if($scope.showComparison) {
                        for(var i = 0; i < $scope.comparisons.length; i++) {
                            if($scope.comparisons[i].downloadValue > ret) {
                                ret = $scope.comparisons[i].downloadValue;
                            }
                            if($scope.comparisons[i].uploadValue > ret) {
                                ret = $scope.comparisons[i].uploadValue;
                            }
                        }
                    }
                    if($scope.vm.downloadSpeed > ret) {
                        ret = $scope.vm.downloadSpeed;
                    }
                    if($scope.vm.uploadSpeed > ret) {
                        ret = $scope.vm.uploadSpeed;
                    }
                    return ret;
                };

                var resetDownload = function() {
                    $scope.vm.downloadSpeed = 0;
                    wlNgNSTComparisonManager.resetDownload();
                };

                var resetUpload = function() {
                    $scope.vm.uploadSpeed = 0;
                    wlNgNSTComparisonManager.resetUpload();
                };

                var computeAverage = function(data, byField) {
                    var sum = 0;
                    for(var i = 0; i < data.length; i++) {
                        if(!byField) {
                            sum += data[i];
                        }else {
                            sum += data[i][byField];
                        }
                    }
                    return sum / data.length;
                };

                $scope.isOnAir = function() {
                    return $scope.vm.testActive || $scope.vm.pingActive || $scope.vm.downloadActive || $scope.vm.uploadActive;
                };

                var ping = function(dfd, iterations, data) {
                    if(!data) {
                        data = [];
                    }
                    wlNgNSTService.ping()
                        .then(function(ret) {
                            $scope.vm.pingIteration++;
                            $scope.vm.pingInstantTime = ret;
                            data.push(ret);
                            if(iterations == 1) {
                                dfd.resolve(computeAverage(data).toFixed(2));
                            }else {
                                ping(dfd, iterations - 1, data);
                            }
                        }, function(error) {
                            $scope.vm.pingIteration++;
                            dfd.reject(error);
                        });
                };

                var download = function(dfd, iterations, data) {
                    if(!data) {
                        data = [];
                    }
                    wlNgNSTService.download()
                        .then(function (ret) {
                            $scope.vm.downloadIteration++;
                            $scope.vm.downloadInstantSpeed = ret.speed;
                            data.push(ret);
                            if(iterations == 1) {
                                dfd.resolve({
                                    time: computeAverage(data, 'time'),
                                    size: computeAverage(data, 'payloadSize'),
                                    speed: computeAverage(data, 'speed')
                                });
                            }else {
                                download(dfd, iterations - 1, data);
                            }
                        }, function (error) {
                            $scope.vm.downloadIteration++;
                            dfd.reject(error);
                        });
                };

                var upload = function(dfd, iterations, data) {
                    if(!data) {
                        data = [];
                    }
                    wlNgNSTService.upload(uploadData)
                        .then(function (ret) {
                            $scope.vm.uploadIteration++;
                            $scope.vm.uploadInstantSpeed = ret.speed;
                            data.push(ret);
                            if(iterations == 1) {
                                dfd.resolve({
                                    time: computeAverage(data, 'time'),
                                    size: computeAverage(data, 'payloadSize'),
                                    speed: computeAverage(data, 'speed')
                                });
                            }else {
                                upload(dfd, iterations - 1, data);
                            }
                        }, function (error) {
                            $scope.vm.uploadIteration++;
                            dfd.reject(error);
                        });
                };

                $scope.ping = function(doNext) {
                    $scope.vm.pingActive = true;
                    $scope.vm.pingIteration = 0;
                    var dfd = $q.defer();
                    ping(dfd, $scope.iterations);
                    dfd.promise
                        .then(function(pingTime) {
                            $scope.vm.pingActive = false;
                            $scope.vm.pingTime = pingTime;
                            if($scope.showDownload && doNext) {
                                $scope.download(doNext);
                            }else if($scope.showUpload && doNext) {
                                $scope.upload();
                            }
                        }, function(error) {
                            $scope.vm.pingActive = false;
                            $scope.vm.pingTime = 0;
                        });
                };

                $scope.download = function(doNext) {
                    $scope.vm.downloadActive = true;
                    $scope.vm.downloadIteration = 0;
                    resetDownload();
                    var dfd = $q.defer();
                    download(dfd, $scope.iterations);
                    dfd.promise
                        .then(function (data) {
                            $scope.vm.downloadActive = false;
                            $scope.vm.downloadSpeed = data.speed;
                            wlNgNSTComparisonManager.refreshDownload();
                            if($scope.showUpload && doNext) {
                                $scope.upload();
                            }
                        }, function (error) {
                            $scope.vm.downloadActive = false;
                            $scope.vm.downloadSpeed = 0;
                            wlNgNSTComparisonManager.resetDownload();
                        });
                };

                $scope.upload = function() {
                    $scope.vm.uploadActive = true;
                    $scope.vm.uploadIteration = 0;
                    resetUpload();
                    var dfd = $q.defer();
                    upload(dfd, $scope.iterations);
                    dfd.promise
                        .then(function (data) {
                            $scope.vm.uploadActive = false;
                            $scope.vm.uploadSpeed = data.speed;
                            wlNgNSTComparisonManager.refreshUpload();
                        }, function (error) {
                            $scope.vm.uploadActive = false;
                            $scope.vm.uploadSpeed = 0;
                            wlNgNSTComparisonManager.resetUpload();
                        });
                };


                $scope.go = function() {

                    $scope.vm.testActive = true;

                    resetDownload();
                    resetUpload();

                    if($scope.showPing) {
                        $scope.ping(true);
                    } else if($scope.showDownload) {
                        $scope.download(true);
                    } else if($scope.showUpload) {
                        $scope.upload();
                    }

                    $scope.vm.testActive = false;

                };

                if($scope.autoTrigger) {
                    var timer = $timeout(
                        function() {
                            $scope.go();
                            $timeout.cancel(timer);
                        },
                        20
                    );
                }

                var timer = $timeout(
                    function() {
                        setDefaultParameters();
                        $timeout.cancel(timer);
                    },
                    10
                );

            }]
        }
    }]);
})();