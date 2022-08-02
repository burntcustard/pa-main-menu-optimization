engine.call('game.debug.menuDocumentReady');

function OneTimePopup(name, filter) {
    var self = this;

    var showPopup = ko.observable(true).extend({ local: 'do_show_notice_' + name + '_popup' });

    self.display = ko.observable(false);
    self.dismiss = function () {
        self.display(false);
    }

    self.setup = function() {
        if (showPopup() && filter())
        {
            self.display(true);
            showPopup(false);
        }
    };
};

function AccountCreationPopup() {
    var self = this;

    var messageUserNameInUse = loc('!LOC:Username already in use.');
    var messageUserNameLengthInvalid = loc('!LOC:UserName must be between 3 and 20 characters.');
    var messageEmailInUse = loc('!LOC:Email already in use.');
    var messageEmailInvalid = loc('!LOC:Email is invalid');
    var messagePasswordsDoNotMatch = loc('!LOC:Passwords do not match.');
    var messagePasswordLengthInvalid = loc('!LOC:Password must be between 6 and 20 characters.');

    var messageInvalidCode = loc('!LOC:The entered code was invalid.');
    var messageTitleAlreadyActivated = loc('!LOC:This account already owns this title.');
    var messageCodeAlreadyUsed = loc('!LOC:The entered code has already been used.');
    var messageCodeConvertedToSteam = loc('!LOC:The entered code has already been converted to a steam key.');

    self.username = ko.observable();
    self.email = ko.observable();
    self.password = ko.observable();
    self.confirmPassword = ko.observable();
    self.key = ko.observable();

    self.usernameError = ko.observable('');
    self.emailError = ko.observable('');
    self.passwordError = ko.observable('');
    self.passwordConfirmError = ko.observable('');
    self.keyError = ko.observable('');
    self.unknownError = ko.observable('');

    self.playfabError = ko.observable('');

    self.waitingForResult = ko.observable(false);
    self.accountCreated = ko.observable(false);
    self.accountAuthorized = ko.observable(false);
    self.accountAlreadyExisted = ko.observable(false);

    self.authorizeExistingAccount = function (username) {
        self.username(username);
        self.accountCreated(true);
        self.accountAuthorized(false);
        self.accountAlreadyExisted(true);
    }

    self.successMessage = ko.observable('');

    self.inputIsValid = ko.computed(function () {

        if (self.accountCreated())
            return !!self.key();

        if (!self.username() || !self.email() || !self.password() || !self.confirmPassword() || !self.key())
            return false;

        if (self.username().length < 3 || self.username().length > 30) {
            self.usernameError(messageUserNameLengthInvalid);
            return false;
        }
        else
            self.usernameError('');

        if (self.password() !== self.confirmPassword()) {
            self.passwordConfirmError(messagePasswordsDoNotMatch);
            return false;
        }
        else
            self.passwordConfirmError('');

        if (self.password().length < 6 || self.password().length > 30) {
            self.passwordError(messagePasswordLengthInvalid);
            return false;
        }
        else
            self.passwordError('');

        return true;
    });

    self.processErrors = function (errors) {
        self.playfabError('');

        var email = errors.Email && errors.Email[0];
        var username = errors.UserName && errors.UserName[0];

        if (email) {
            if (email === 'Email is not vaild.')
                self.playfabError(messageEmailInvalid);
            else if (email === "Email address already exists. ")
                self.playfabError(messageEmailInUse);
            else
                self.playfabError(email);
        }
        else if (username) {
            if (username === 'User name already exists.')
                self.playfabError(messageUserNameInUse);
            else
                self.playfabError(username);
        }
    };

    self.next = function () {
        if (self.waitingForResult())
            return;

        self.playfabError('');
        self.waitingForResult(true);

        if (self.accountCreated())
            self.redeemKey();
        else
            self.createAccount();
    }

    self.createAccount = function () {
        engine.asyncCall("ubernet.createUberNetAccount",
                    String(self.username()),
                    String(self.email()),
                    String(self.password()),
                    String(self.confirmPassword()))
        .done(function (data) {
            var result = parse(data);
            if (result.Errors) {
                self.processErrors(result.Errors);
                return;
            }

            self.accountCreated(true);
            self.redeemKey();
        })
        .fail(function (data) {
            console.error('createUberNetAccount fail');
            console.error(data);

            var result = parse(data);
            if (result.Errors) {
                self.processErrors(result.Errors);
                return;
            }
        })
        .always(function () {
            self.waitingForResult(false);
        });
    };

    self.redeemKey = function () {

        var activationSuccess = function () {
            self.accountAuthorized(true);
            self.successMessage(loc('!LOC:Your username is: __username__', { username: self.username() }));
            model.uberName(self.username());
            model.password(self.password());
            model.authenticateWithUberNetLogin();
        };

        var activationError = function (error) {
            switch (error) {
                case 'InvalidActivationCode':
                    self.playfabError(messageInvalidCode);
                    break;
                case 'TitleAlreadyActivatedForUser':
                    self.playfabError(messageTitleAlreadyActivated);
                    break;
                case 'ActivationCodeAlreadyUsed':
                    self.playfabError(messageCodeAlreadyUsed);
                    break;
                case 'ActivationCodeConvertedToSteamKey':
                    self.playfabError(messageCodeConvertedToSteam);
                    break;
            }
        }

        var call = engine.asyncCall("ubernet.activateTitle", String(self.key()));
        call.done(function (data) {
            data = parse(data);
            if (data === 'Success')
                activationSuccess();
            else
                activationError(data);
        });
        call.fail(function (data) {
            console.error('activateTitle : fail');
            console.error(data);
            data = parse(data);

            if (!data)
                return;

            data = parse(data);
        });
    }
}

function LoginViewModel() {
    var self = this;

    self.showTutorialPopup = ko.observable(false);
    self.doShowTutorialPopup = ko.observable(true).extend({ local: 'do_show_tutorial_popup' });

    self.maybeShowTutorialPopup = function () {

        if (!api.content.usingTitans())
            return false;

        if (self.doShowTutorialPopup()) {
            self.showTutorialPopup(true);
            self.doShowTutorialPopup(false);
            self.showSinglePlayerMenu(false);
            self.showMultiplayerMenu(false);
            return true;
        }

        return false;
    }

    self.doShowTutorialContinuePopup = ko.observable(false);
    self.showTutorialContinuePopup = ko.observable(false);
    var showTutorialContinuePopupRule = ko.computed(function () {
        var recent = SaveGameUtility.mostRecentGame();
        if (recent && recent.name === "Tutorial")
            self.doShowTutorialContinuePopup(true);
    });

    self.startTutorial = function () {
        ko.observable().extend({ local: 'gw_active_game' })("tutorial");
        window.location.href = 'coui://ui/main/game/galactic_war/gw_play/gw_play.html';
    }

    self.startTutorialOrShowPopup = function () {
        self.doShowTutorialPopup(false);
        if (!self.doShowTutorialContinuePopup()) {
            self.startTutorial();
        } else {
            self.showTutorialContinuePopup(true);
        }
    };

    self.showRedirectToNewAppid = ko.observable(false);
    self.oneTimePopups = {
        titans_gift:          new OneTimePopup('titans_gift',   function() { return api.content.titansWasKSGift() && (!api.steam.hasClient() || api.content.usingTitans()); }),
        titans_gift_on_steam: new OneTimePopup('titans_gift',   function() { return api.content.titansWasKSGift() && api.steam.hasClient() && !api.content.usingTitans(); }),
    };

    self.showCreateUbernetAccountPopup = ko.observable(false);
    self.accountCreationPopup = new AccountCreationPopup();
    self.openAccountCreationPopup = function () {
        self.showCreateUbernetAccountPopup(true);
    };
    self.closeAccountCreationPopup = function () {
        self.showCreateUbernetAccountPopup(false);
    };

    self.openTitleActivationPopup = function () {
        self.accountCreationPopup.authorizeExistingAccount(self.uberName());
        self.showCreateUbernetAccountPopup(true);
    };

    self.fullUpdate = ko.observable(false);
    self.fullUpdateText = ko.computed(function () {
        return loc(self.fullUpdate() ? '!LOC:Minimize' : '!LOC:View full column');
    });
    self.toggleFullUpdate = function () {
        self.fullUpdate(!self.fullUpdate());
    };

    self.hasCmdLineTicket = ko.observable(false);
    self.pageMessage = ko.observable();

    self.isSteamClientOnline = ko.observable().extend({ session: 'is_steam_client_online' });
    self.useSteam = ko.computed(function () {
        return api.steam.hasClient() && self.isSteamClientOnline();
    });
    self.notUsingSteam = ko.computed(function () {
        return !self.useSteam();
    });

    self.allowMicroTransactions = ko.observable().extend({ session: 'allow_micro_transactions' });
    self.microTransactionsAvailable = ko.observable().extend({ session: 'micro_transactions_available' });

    self.displayMode = ko.observable().extend({ session: 'display_mode' });

    self.readyToLogin = ko.observable(false);
    self.modeArray = ['startup', 'sign-in', 'ready']
    self.mode = ko.observable(0).extend({ session: 'start_mode' });

    self.hasSetupInfo = ko.observable().extend({ session: 'has_setup_info' });
    self.setupInfo = ko.observable().extend({ session: 'setup_info' });

    self.uiOptions = ko.observable({}).extend({ session: 'ui_options' });

    self.modeString = ko.computed(function () { return self.modeArray[self.mode()]; });
    self.showingSignIn = ko.computed(function () { return self.mode() === 1 && !self.useSteam() && !self.hasCmdLineTicket(); });
    self.showingReady = ko.computed(function () { return self.mode() === 2; });
    self.hasEverSignedIn = ko.observable(false).extend({ local: 'has_ever_signed_in' });
    self.showFirstTimeSignIn = ko.observable(false);
    self.startFirstSignIn = function () {
        self.showFirstTimeSignIn(true);
    };

    self.ajaxCallsInFlight = ko.observable(0);
    self.waitingForAjax = ko.computed(function () { return self.ajaxCallsInFlight() > 0; });

    self.usernameError = ko.observable('');
    self.emailError = ko.observable('');
    self.passwordError = ko.observable('');

    self.introVideoComplete = function() {
        engine.call('audio.pauseMusic', false);
    };

    self.inRegionSetup = ko.observable(false);

    self.lastSceneUrl = ko.observable().extend({ session: 'last_scene_url' });
    self.nextSceneUrl = ko.observable().extend({ session: 'next_scene_url' });

    self.passwordConfirm = ko.observable('');

    self.preferredCommander = ko.observable().extend({ local: 'preferredCommander_v2' });
    // self.preferredCommanderImage = ko.observable(null);

    self.hasEverSelectedCommander = ko.observable().extend({ local: 'hasEverSelectedCommander_v2' });

    self.commanderImage = ko.observable(null);

    CommanderUtility.afterCommandersLoaded(function()
    {
        if (self.preferredCommander())
        {
            return self.commanderImage(CommanderUtility.bySpec.getImage(self.preferredCommander()));
        }

        var commanders = CommanderUtility.getKnownCommanders();

        if (commanders.length) {
            if (self.signedInToUbernet())
            {
                commanders = _.filter(commanders, function(commanderSpec)
                {
                    var objectName = CommanderUtility.bySpec.getObjectName(commanderSpec);

                    var catalogItem = PlayFab.getCatalogItem(objectName);

                    return catalogItem && catalogItem.NotForSale;
                });
            }

            self.commanderImage(CommanderUtility.bySpec.getImage(_.shuffle(commanders)[0]));
        }

        return null;
    });

    // reset previous game info
    self.lobbyId = ko.observable().extend({ session: 'lobbyId' });
    self.lobbyId(undefined);
    self.reconnectContent = ko.observable().extend({ session: 'game_content' });
    self.reconnectContent(undefined);
    self.gameTicket = ko.observable('').extend({ session: 'gameTicket' });
    self.gameTicket(undefined);
    self.gameHostname = ko.observable().extend({ session: 'gameHostname' });
    self.gameHostname(undefined);
    self.gamePort = ko.observable().extend({ session: 'gamePort' });
    self.gamePort(undefined);

    self.isLocalGame = ko.observable().extend({ session: 'is_local_game' });
    self.isLocalGame(undefined);
    self.serverType = ko.observable().extend({ session: 'game_server_type' });
    self.serverType(undefined);
    self.gameModIdentifiers = ko.observableArray().extend({ session: 'game_mod_identifiers' });
    self.gameModIdentifiers([]);
    self.serverSetup = ko.observable().extend({ session: 'game_server_setup' });
    self.serverSetup(undefined);
    self.gameType = ko.observable().extend({ session: 'game_type' });
    self.gameType(undefined);
    self.uuid = ko.observable('').extend({ session: 'invite_uuid' });
    self.uuid(undefined);
    self.privateGamePassword = ko.observable().extend({ session: 'private_game_password' });
    self.privateGamePassword('');

    self.password = ko.observable('');
    self.uberName = ko.observable('').extend({ local: 'uberName' });
    self.uberUserInfo = ko.observable({}).extend({ session: 'uberUserInfo' });
    self.userTitleData = ko.observable({}).extend({ session: 'uberTitleInfo' });

    // Commented out, because not used. TODO: Remove completely?
    // var userTitleDataRule = ko.computed(function () {
    //     var user_info = self.uberUserInfo();

    //     if (user_info && user_info.UserTitleData)
    //         self.userTitleData(user_info.UserTitleData);
    // });

    self.uberId = api.net.uberId;

    self.displayName = ko.observable('').extend({ session: 'displayName' });
    self.displayNameRule = ko.computed(function () {
        var userInfo = self.uberUserInfo();

        if (!_.isEmpty(userInfo)) {
            if (userInfo.TitleDisplayName)
                self.displayName(userInfo.TitleDisplayName);
            else if (self.userTitleData() && self.userTitleData().DisplayName)
                self.displayName(self.userTitleData().DisplayName);
            else if (userInfo.DisplayName)
                self.displayName(userInfo.DisplayName);
            else if (userInfo.UberName)
                self.displayName(userInfo.UberName);
        }
    });

    self.uberbarIdentifiers = ko.computed(function () {
        return {
            'uber_id': self.uberId(),
            'uber_name': self.uberName(),
            'display_name': self.displayName()
        }
    });
    self.uberbarIdentifiers.subscribe(function () {
        api.Panel.message('uberbar', 'uberbar_identifiers', self.uberbarIdentifiers());
    });

    self.jabberToken = ko.observable().extend({ session: 'jabberToken' });

    self.buildVersion = ko.observable().extend({ session: 'build_version' });
    self.buildVersionLocal = ko.observable().extend({ local: 'build_version' });

    self.ubernetBuildVersion = ko.observable().extend({ session: 'ubernet_build_version' });
    self.stableBuildVersion = ko.observable().extend({ session: 'stable_build_version' });

    self.buildNeedsUpdate = ko.pureComputed(function ()
    {
        if (DEV_MODE || ! self.stableBuildVersion() || ! self.buildVersion())
            return false;

        function getBranch(build)
        {
            var branchIndex = build.indexOf('-');
            if (branchIndex >= 0)
                return build.substring(branchIndex);
            return '';
        }

        if (getBranch(self.buildVersion()) !== getBranch(self.stableBuildVersion()))
            return false;

        return self.buildVersion() < self.stableBuildVersion();
    });

    self.videoToPlayFullScreen = ko.observable('');

    self.videoToPlayAutoplay = ko.observable(false);
    self.videoAutoplayString = ko.computed(function () {
        return self.videoToPlayAutoplay() ? '1' : '0';
    });

    self.videoToPlayFullScreenIframeSource = ko.computed(function () {
        return 'http://www.youtube.com/embed/' + self.videoToPlayFullScreen() + '?modestbranding=1&amp;rel=0&amp;autoplay='
                + self.videoAutoplayString() + '&amp;showinfo=0&amp;controls=0&amp;HD=1;vq=hd1080';
    });
    self.videoTitleFullScreen = ko.observable('Planetary Annihilation');
    self.videoLaunchExternal = function () {
        api.youtube.launchPage(self.videoToPlayFullScreen());
    }

    self.os = ko.observable('').extend({ session: 'os' });
    self.uberNetRegion = ko.observable().extend({ local: 'uber_net_region' });
    self.selectedUberNetRegion = ko.observable();
    self.uberNetRegions = ko.observableArray().extend({ session: 'uber_net_regions' });
    self.hasUberNetRegion = ko.computed(function () { return self.uberNetRegions().length ? true : false; });
    self.redirectToServer = ko.observable(false);
    self.redirectToReplay = ko.observable(false);
    self.redirectToCustomGame = ko.observable(false);
    self.redirectToGalacticWar = ko.observable(false);
    self.redirectToAISkirmish = ko.observable(false);
    self.redirectToMatchMaking = ko.observable(true);

    self.lastNewsSeen = ko.observable(0).extend({ local: 'lastNewsSeen' });

    self.useUbernetdev = ko.observable(false).extend({ session: 'use_ubernetdev' });

    self.localServerAvailable = ko.observable().extend({ session: 'local_server_available' });
    self.localServerRecommended = ko.observable().extend({ session: 'local_server_recommended' });
    self.localServerSetting = ko.observable().extend({ setting: { group: 'server', key: 'local' } });
    self.useLocalServer = ko.observable().extend({ session: 'use_local_server' });
    self.useLocalServerRule = ko.computed(function ()
    {
        if (!self.localServerAvailable())
            return false;
        var setting = self.localServerSetting();
        if (setting === 'OFF')
            return false;
        if (setting === 'ON')
            return true;
        return self.localServerRecommended();
    });
    self.useLocalServerRule.subscribe(self.useLocalServer);
    self.useLocalServer(self.useLocalServerRule());

    self.localServerMultiThreadSetting = ko.observable().extend({ setting: { group: 'server', key: 'multi_threading' } });
    self.useLocalServerMultiThreading = ko.observable().extend({ session: 'use_local_server_multi_threading' });
    self.useLocalServerMultiThreadingRule = ko.computed(function ()
    {
        var setting = self.localServerMultiThreadSetting();
        if (setting === 'OFF')
            return false;
        if (setting === 'ON')
            return true;
        return true;
    });
    self.useLocalServerMultiThreadingRule.subscribe(self.useLocalServerMultiThreading);
    self.useLocalServerMultiThreading(self.useLocalServerMultiThreadingRule());

    self.aiSkirmish = ko.observable().extend({ session: 'ai_skirmish' });

    self.signedInToUbernet = ko.observable().extend({ session: 'signed_in_to_ubernet' });

    self.jabberAuthentication = ko.computed(function () {
        return {
            'uber_id': self.uberId(),
            'jabber_token': self.jabberToken(),
            'use_ubernetdev': self.useUbernetdev()
        };
    });
    self.resetJabber = (function () {
        var previous = {};

        return function (value) {
            if (!self.uberId() || !self.jabberToken() || JSON.stringify(value) === JSON.stringify(previous))
                return;

            previous = value;
            api.Panel.message('uberbar', 'jabber_authentication', self.jabberAuthentication());
        }
    })();

    self.jabberAuthentication.subscribe(self.resetJabber);

    self.showConnecting = ko.observable(false);
    self.showReconnect = ko.observable(false);
    self.showError = ko.observable(false);

    self.showNewBuild = ko.observable(false);

    self.signalRecompute = ko.observable();
    self.welcomeVideoId = ko.observable('PgVIMcFlWvQ'); // old: vGGCeWLlFFI, wrHcJpGxcK4
    self.helpVideoId = ko.observable('1zedpeYS0_s'); //old: DGW5Nmwyeqc //new: E7Zp32Nlu7Q //newest: http://youtu.be/
    self.showHelpVideo = ko.observable(false);
    self.showVideoFromList = ko.observable(false);
    self.currentVideoId = ko.computed(function () { return (self.showHelpVideo()) ? self.helpVideoId() : self.welcomeVideoId() });

    self.videoDialogHeight = ko.computed(function () {
        self.signalRecompute(); /* create dependency */
        return window.innerHeight - 10;
    });
    self.videoDialogWidth = ko.computed(function () {
        self.signalRecompute(); /* create dependency */
        return window.innerWidth - 10;
    });
    self.videoHeight = ko.computed(function () {
        self.signalRecompute(); /* create dependency */
        return window.innerHeight - 230;
    });
    self.videoWidth = ko.computed(function () {
        self.signalRecompute(); /* create dependency */
        return window.innerWidth - 200;
    });

    self.isUberNetRegionAvailable = ko.computed(function () {
        var i;

        for (i = 0; i < self.uberNetRegions().length ; i++)
            if (self.uberNetRegions()[i].Name === self.uberNetRegion())
                return true;

        return false;
    });

    self.showUberNetGames = ko.computed(function () {
        return self.hasUberNetRegion();
    });

    self.allowUbernetActions = ko.computed(function () {
        return self.uberId().length > 0;
    });

    self.disallowUbernetActions = ko.computed(function () {
        /* Don't disallow yet, we're (hopefully quickly) logging in */
        if (self.showConnecting())
            return false;

        return self.uberId() === '';
    });

    self.allowNewOrJoinGame = ko.computed(function () {
        return self.allowUbernetActions() || self.useLocalServer();
    });

    self.videoLoaded = ko.observable(false);

    self.graphicsVendor = ko.observable().extend({ session: 'graphics_vendor' });

    var steamID = ko.pureComputed(function() {
        if (!self.useSteam())
            return null;
        var steamID = _.get(gEngineParams, ['steam', 'steamid']);
        if (!_.isString(steamID) || _.isEmpty(steamID))
            return null;
        return steamID;
    });

    self.gogId = ko.observable().extend({ session: 'gog_id' });
    self.gogPersonaName = ko.observable().extend({ session: 'gog_persona_name' });

    self.canCreateAnonymousAccount = ko.pureComputed(function () {
        return !_.isEmpty(steamID());
    });

    var updateSteamName = function(deferred, suffix)
    {
        var name = gEngineParams.steam.persona_name;
        if (suffix)
            name += ' (' +  suffix + ')';
        else
            suffix = 0;

        var retry = function() {
            if (suffix >= 99)
                return false;

            console.warn("Name " + name + " taken. Trying another one.");
            suffix += 1;
            updateSteamName(deferred, suffix);

            return true;
        };

        engine.asyncCall('ubernet.call', '/GameClient/UpdateUserTitleDisplayName?' +  $.param({ DisplayName: name }), true)
            .done(function(data) {
                var result = null;
                try {
                    result = JSON.parse(data);
                } catch (e) {
                    console.error("Unable to parse UpdateUserTitleDisplayName result: " + data);
                }

                if (!result || result.Result !== 'Success' || result.DisplayName !== name)
                {
                    if (!result || !retry())
                    {
                        console.error("Failed to update display name to match Steam name (" + gEngineParams.steam.persona_name + "): " + data);
                        deferred.resolve();
                    }
                }
                else
                {
                    self.displayName(result.DisplayName);
                    deferred.resolve();
                }
            })
            .fail(function(data) {
                var handled = false;
                if (!_.isEmpty(data))
                {
                    try {
                        var result = JSON.parse(data);
                        if (result && result.ErrorCode == 401 && result.Message === "NameNotAvailable")
                        {
                            handled = retry();
                        }
                    } catch (e) {
                        console.error("Unable to parse UpdateUserTitleDisplayName error: " + data);
                    }
                }

                if (!handled)
                {
                    console.error("Failed to update display name to match Steam name (" + gEngineParams.steam.persona_name + "): " + data);
                    deferred.resolve();
                }
            });
    };

    var finishAuthentication = function(data)
    {
        self.uberUserInfo(data);
        self.uberName(data.UberName);
        self.uberId(data.UberIdString);

        if (data.SessionTicket)
            self.jabberToken(data.SessionTicket);

        self.hasEverSignedIn(true);
        self.signedInToUbernet(true);
        self.mode(2);
        self.requestRegions();
        self.getGameWithPlayer();

        var catalogDeferred = $.Deferred();

        PlayFab.updateCatalog(function ()
        {
            api.content.catalogUpdated();

            _.forOwn(self.oneTimePopups, function(popup, name) { popup.setup(); });
            if (api.steam.hasClient() && !_.some(self.oneTimePopups, function(popup) { return popup.display(); }))
                self.showRedirectToNewAppid(!api.content.ownsTitans() && api.steam.accountOwnsTitans());

            catalogDeferred.resolve();

            self.loadCommanderImages();
        });

        var connectionCompleteDeferred = catalogDeferred;
        var useSteamName = api.settings.getSynchronous('user', 'username_policy') === 'STEAM';

        if (useSteamName && self.useSteam() && !_.isEmpty(gEngineParams.steam.persona_name) && self.displayName() !== gEngineParams.steam.persona_name)
        {
            var displayNameDeferred = $.Deferred();
            updateSteamName(displayNameDeferred);
            connectionCompleteDeferred = $.when(catalogDeferred, displayNameDeferred);
        }

        connectionCompleteDeferred.always(function() {
            if (self.showConnecting()) {
                self.showConnecting(false);
                $("#connecting").dialog("close");
            }
        });
    };

    /**
     * Remove createAnonymousSteamAccount because everyone playing Pa
     * is on Steam (not Uber?) already
     */
    // self.createAnonymousSteamAccount = function () {
    //     var steamIDStr = steamID();
    //     if (_.isEmpty(steamIDStr))
    //     {
    //         console.error("Got createAnonymousSteamAccount, but no Steam ID.");
    //         return;
    //     }

    //     var hexID = bigInt2str(str2bigInt(steamIDStr, 10), 16);
    //     /* Usernames are limited to 20 characters. 64 bit number in hex is up to 16. */
    //     var ubername = "steam" + hexID;
    //     /* Passwords are limited to 30 characters. */
    //     var password = UberUtility.randomString(26);

    //     var email = "steamanonymous+" + steamIDStr + "@uberent.com";

    //     engine.asyncCall("ubernet.createUberNetAccountViaSteam",
    //                      ubername,
    //                      email,
    //                      password,
    //                      password)
    //         .done(function (data) {
    //             var data = JSON.parse(data);

    //             console.log('createUberNetAccount done');
    //             console.log(data);
    //             finishAuthentication(data);
    //         })
    //         .fail(function (data) {
    //             var r = JSON.parse(data);

    //             function showErrorDialog(extra_info) {
    //                 /* we could also show the error message from backend (error.Message), however the client side messages for the error code are localized.
    //                    the client side messages were generated to match the backend messages. */
    //                 $("#errorText").text(extra_info);
    //                 $("#error").dialog('open');
    //                 self.showError(true);
    //             }

    //             if (r.ErrorCode === 6 && r.Errors && r.Errors.UserName) {
    //                 showErrorDialog(loc('!LOC:Unable to link your Steam account (username in use), contact us at __email__', { email: "support@planetaryannihilation.com" }));
    //             } else if (r.ErrorCode === 7 && r.Errors && r.Errors.Email) {
    //                 showErrorDialog(loc('!LOC:Unable to link your Steam account (email address in use), contact us at __email__', { email: "support@planetaryannihilation.com" }));
    //             } else if (r.ErrorCode === 400 && r.Errors && r.Errors.ConfirmPassword) {
    //                 showErrorDialog(loc('!LOC:Unable to link your Steam account, try restarting the game or contact us at __email__', { email: "support@planetaryannihilation.com" }));
    //             } else if (r.ErrorCode === 400 && r.Errors && r.Errors.UserName) {
    //                 showErrorDialog(r.Errors.UserName[0]);
    //             } else  if (r.ErrorCode === 400 && r.Errors && r.Errors.Email) {
    //                 showErrorDialog(loc('!LOC:Unable to link your Steam account (email address invalid), contact us at __email__', { email: "support@planetaryannihilation.com" }));
    //             } else {
    //                 showErrorDialog(loc('!LOC:Unable to link your Steam account (unknown error __code__), contact us at __email__', { code: r.ErrorCode, email: "support@planetaryannihilation.com" }));
    //             }
    //         });
    // };

    function authenticateHelper(/* varargs */) {
        engine.asyncCall.apply(engine, arguments)
            .done(function (data_str) {
                var data = parse(data_str);
                finishAuthentication(data);

                api.settings.load(true /* force */, false /* local */).then(function () {
                    api.settings.apply(['graphics', 'audio', 'camera', 'ui', 'server']);
                });
            })
            .fail(function (error_str) {
                var error = parse(error_str);
                console.log('authenticateHelper : fail');
                console.log(error);

                self.signedInToUbernet(false);
                self.hasCmdLineTicket(false);

                $("#connecting").dialog("close");

                function showErrorDialog(exit_on_close, extra_info) {
                    /* we could also show the error message from backend (error.Message), however the client side messages for the error code are localized.
                        the client side messages were generated to match the backend messages. */
                    $("#errorText").text(extra_info);
                    $("#error").dialog('open');
                    self.showError(true);
                }
                switch (error.ErrorCode) {
                    case -1: showErrorDialog(false, "Client Error -1."); break; /* Custom client error */
                    case -2: showErrorDialog(false, "Client Error -2."); break; /* Custom client error */
                    case -3: showErrorDialog(false, "Client Error -3."); break; /* Custom client error */
                    case -4: showErrorDialog(false, "Client Error -4."); break; /* Custom client error */
                    case -5: showErrorDialog(false, "Client Error -5: " + loc("!LOC:Invalid session ticket, please log in again.")); break; /* Custom client error */
                    case 1: showErrorDialog(false, loc("!LOC:Incorrect username or password. Please check your entry and try again.")); break; /* InvalidUsernameOrPassword */
                    // case 2: /* UserNotLinkedToSteam */
                    //     if (self.canCreateAnonymousAccount())
                    //     {
                    //         self.createAnonymousSteamAccount();
                    //     }
                    //     else /* This shouldn't show up. */
                    //     {
                    //         showErrorDialog(false, loc("!LOC:There is a problem with Steam. Please restart Steam and try again, or contact us at __email__", { email: "support@planetaryannihilation.com" }));
                    //     }
                    //     break;
                    // case 6: /* RegistrationIncomplete */
                    //     if (self.canCreateAnonymousAccount())
                    //     {
                    //         self.createAnonymousSteamAccount();
                    //     }
                    //     else /* This shouldn't show up. */
                    //     {
                    //         showErrorDialog(false, loc("!LOC:Oops! Your account seems to be in an invalid state. If you are a Steam user, please restart Steam and try again. If the problem persists, contact us at __email__", { email: "support@planetaryannihilation.com" }));
                    //     }
                    //     break;
                    case 3:
                        showErrorDialog(true, loc("!LOC:This shouldn't happen. Please contact us at  __email__", { email: "support@planetaryannihilation.com" }));
                        break; /* Not Possible */
                    case 4:
                        showErrorDialog(true, loc("!LOC:This shouldn't happen. Please contact us at  __email__", { email: "support@planetaryannihilation.com" }));
                        break; /* Not Possible */
                    case 5:
                        showErrorDialog(false, loc("!LOC:There is a problem with Steam. Please restart Steam and try again, or contact us at __email__", { email: "support@planetaryannihilation.com" }));
                        break; /* InvalidSteamTicket */
                    case 7:
                        showErrorDialog(true, loc("!LOC:Your account has been banned. If you believe this is in error, contact us at __email__", { email: "support@planetaryannihilation.com" }));
                        break; /* AccountBanned */
                    case 8:
                        self.openTitleActivationPopup();
                        break; /* TitleNotActivated */
                    case 9:
                        showErrorDialog(true, loc("!LOC:Oops! We can't find the game in your account.  If you are a Steam user, please restart Steam and try again.  If the problem persists, contact us at __email__", { email: "support@planetaryannihilation.com" }));
                        break; /* SteamApplicationNotOwned */

                    default: {
                        var errorCode = error.ErrorCode;
                        if (!errorCode)
                            errorCode = error_str;
                        else
                            errorCode = errorCode.toString();
                        var message = loc("!LOC:Unknown Error authenticating, possibly related to firewall or antivirus settings.  Please contact support if problem persists. (__error_code__)", { error_code: errorCode });
                        showErrorDialog(false, message);
                        break;
                    }

                }
            });
    }

    self.authenticateWithCmdLineTicket = function () {
        authenticateHelper("ubernet.authenticateWithCmdLineTicket");
    }

    self.authenticateWithUberNetLogin = function () {
        authenticateHelper("ubernet.authenticateWithUberNetLogin",
                            self.uberName(),
                            self.password());
    }

    self.authenticateWithSteamTicket = function () {
        authenticateHelper("ubernet.authenticateWithSteamTicket");
    }

    self.ubernetLoginIn = function () {

        self.showConnecting(true);
        $("#msg_progress").text(loc("!LOC:Connecting to PA"));
        $("#connecting").dialog('open');

        if (self.hasCmdLineTicket())
            self.authenticateWithCmdLineTicket();
        else if (self.useSteam())
            self.authenticateWithSteamTicket();
        else
            self.authenticateWithUberNetLogin();
    };

    self.ubernetLogout = function () {
        self.mode(1);
        self.uberId('');
        self.jabberToken('');
        self.signedInToUbernet(false);
    };

    self.requestRegions = function () {
        engine.asyncCall("ubernet.getGameServerRegions").then(
            function (data, status) {
                var i;

                data = JSON.parse(data);

                if (data.Regions) {
                    self.uberNetRegions([]);

                    for (i = 0; i < data.Regions.length; i++) {
                        self.uberNetRegions.push(data.Regions[i]);
                    }
                }
            },
            function (error) {
                console.log('regions:fail: ' + error);
            }
        );
    }

    self.rejoinGame = function () {
        self.showReconnect(false);

        self.gameHostname(null);
        self.gamePort(null);
        self.isLocalGame(false);
        self.serverType('uber');
        self.serverSetup(undefined);

// try to set game type, mod identifiers and uuid if we have matching reconnect info

        var reconnectToGameInfo = self.reconnectToGameInfo();

        var gameType = undefined;
        var mods = undefined;
        var uuid = '';

        if ( reconnectToGameInfo && reconnectToGameInfo.lobby_id == self.lobbyId() && reconnectToGameInfo.uberId == self.uberId() ) {
            gameType = reconnectToGameInfo.type;
            mods = reconnectToGameInfo.mods;
            uuid = reconnectToGameInfo.uuid;
        }

        self.gameType( gameType );
        self.gameModIdentifiers( mods );
        self.uuid( uuid );

        var params = {
            content: self.reconnectContent(),
        };
        window.location.href = 'coui://ui/main/game/connect_to_game/connect_to_game.html?' + $.param(params);
    };

    self.abandon = function () {
        api.net.removePlayerFromGame();
    }

    self.getGameWithPlayer = function ()
    {
        engine.asyncCall("ubernet.getGameWithPlayer").done(function (data)
        {
            data = JSON.parse(data);
            if (data.PlayerInGame)
            {
                var mode = data.GameMode || '';

                if (_.endsWith(mode, 'Ladder1v1'))
                {
                    self.startMatchMaking();
                    return;
                }

                self.showReconnect(true);
                self.lobbyId(data.LobbyID);

                if (mode.indexOf(':') > 0)
                    self.reconnectContent(mode.substr(0, mode.indexOf(':')));
                else
                    self.reconnectContent(null);

                $("#reconnectDlg").dialog('open');
            }
        });
    }

    self.fetchStableBuild = function()
    {
        engine.asyncCall("ubernet.getCurrentClientVersion").then(function (data)
        {
            var old_version = self.stableBuildVersion();
            self.ubernetBuildVersion(data);
            self.stableBuildVersion(data);

            if (!DEV_MODE && self.buildNeedsUpdate() && old_version !== self.stableBuildVersion())
            {
                self.showNewBuild(true);
                $(".div_build_number_dialog").dialog('open');
            }
        });
    };

    self.getUbernetBuildNumber = self.fetchStableBuild;

    self.showRanked = ko.computed( function()
    {
        return api.content.usingTitans();
    });

    self.disableRanked = ko.computed( function()
    {
        return !self.allowUbernetActions();
    });

    self.navToServerBrowser = function () {

        if (self.maybeShowTutorialPopup())
            return;

        if (!self.allowNewOrJoinGame())
            return;

        self.redirectToServer(true);
        self.aiSkirmish(false);
        if (!model.hasUberNetRegion() || model.isUberNetRegionAvailable()) {
            model.inRegionSetup(false);
            window.location.href = 'coui://ui/main/game/server_browser/server_browser.html';
            return; /* window.location.href will not stop execution. */
        }
        else {
            model.inRegionSetup(true);
            $("#regionDlg").dialog('open');
        }
    }

    self.navToArmory = function()
    {
        window.location.href = 'coui://ui/main/game/armory/armory.html';
        return; /* window.location.href will not stop execution. */
    }

    self.navToReplayBrowser = function () {
        if (!self.allowUbernetActions())
            return;

        self.aiSkirmish(false);
        self.redirectToReplay(true);
        if (!model.hasUberNetRegion() || model.isUberNetRegionAvailable()) {
            model.inRegionSetup(false);
            window.location.href = 'coui://ui/main/game/replay_browser/replay_browser.html';
            return; /* window.location.href will not stop execution. */
        }
        else {
            model.inRegionSetup(true);
            $("#regionDlg").dialog('open');
        }
    }

    self.navToLoadSavedGame = function () {

        if (self.maybeShowTutorialPopup())
            return;

        window.location.href = 'coui://ui/main/game/save_game_browser/save_game_browser.html';
    }

    self.navToSettings = function () {
        window.location.href = 'coui://ui/main/game/settings/settings.html';
        return; /* window.location.href will not stop execution. */
    }

    self.mostRecentGame = SaveGameUtility.mostRecentGame;

    self.startMatchMaking = function (options) {

        if (self.maybeShowTutorialPopup())
            return;

        if (!self.allowUbernetActions())
            return;

        options = options || {};

        self.aiSkirmish(false);
        self.redirectToMatchMaking(true);
        if (model.isUberNetRegionAvailable()) {
            model.inRegionSetup(false);

            var skipGameCheck = ko.observable().extend({ session: 'matchmaking_skip_game_check' });
            skipGameCheck(!!options.skip_existing_game_check)

            window.location.href = 'coui://ui/main/game/matchmaking/matchmaking.html';
        }
        else {
            model.inRegionSetup(true);
            $("#regionDlg").dialog('open');
        }
    }

    self.navToLeaderBoard = function () {
        // if (!self.allowUbernetActions())
        //     return;

        window.location.href = 'coui://ui/main/game/leaderboard/leaderboard.html';
        return; /* window.location.href will not stop execution. */
    };

    self.navToGuide = function () {
        window.location.href = 'coui://ui/main/game/guide/guide.html';
        return; /* window.location.href will not stop execution. */
    };


    self.showSinglePlayerMenu = ko.observable(false);
    self.toggleSinglePlayerMenu = function () {
        if (!self.allowNewOrJoinGame())
            return;
        self.showSinglePlayerMenu(!self.showSinglePlayerMenu());
        self.showMultiplayerMenu(false);
    };
    self.showMultiplayerMenu = ko.observable(false);
    self.toggleMultiplayerMenu = function () {
        if (!self.allowNewOrJoinGame())
            return;
        self.showMultiplayerMenu(!self.showMultiplayerMenu());
        self.showSinglePlayerMenu(false);
    };

    self.hideSubMenus = function(data, event) {
        if (document.getElementById("navigation_panel").contains(event.target))
            return;

        self.showSinglePlayerMenu(false);
        self.showMultiplayerMenu(false);
    };

    self.galacticWarMode = ko.observable('');
    this.navToGalacticWar = function (mode) {

        if (self.maybeShowTutorialPopup())
            return;

        self.aiSkirmish(false);
        self.redirectToGalacticWar(true);
        if (model.useLocalServer() || model.isUberNetRegionAvailable()) {
            model.inRegionSetup(false);
            var params = {};
            if (!_.isEmpty(self.galacticWarMode()))
                params['mode'] = self.galacticWarMode();
            else
                params['content'] = api.content.activeContent();
            window.location.href = 'coui://ui/main/game/galactic_war/gw_start/gw_start.html?' + $.param(params);
            return; /* window.location.href will not stop execution. */
        }
        else {
            model.inRegionSetup(true);
            $("#regionDlg").dialog('open');
        }
    }
    self.navToAISkirmish = function () {

        if (self.maybeShowTutorialPopup())
            return;

        self.aiSkirmish(true);
        self.redirectToAISkirmish(true);
        if (self.useLocalServer() || self.isUberNetRegionAvailable()) {
            self.inRegionSetup(false);
            self.lastSceneUrl(window.location.href);

            var params = {
                action: 'start',
                content: api.content.activeContent(),
            };
            if (self.useLocalServer())
                params['local'] = true;

            window.location.href = 'coui://ui/main/game/connect_to_game/connect_to_game.html?' + $.param(params);
            return;
        }
        else {
            model.inRegionSetup(true);
            $("#regionDlg").dialog('open');
        }
    };

    this.navToNewPlanet = function () {
        window.location.href = 'coui://ui/main/game/system_editor/system_editor.html';
        return; /* window.location.href will not stop execution. */
    }

    this.navToEditPlanet = function () {
        self.nextSceneUrl('coui://ui/main/game/system_editor/system_editor.html');
        window.location.href = 'coui://ui/main/game/load_planet/load_planet.html';
        return; /* window.location.href will not stop execution. */
    }

    self.finishRegionSetup = function () {
        model.uberNetRegion(model.selectedUberNetRegion());

        if (!self.uberNetRegion() || !self.isUberNetRegionAvailable())
            return; /* do nothing */

        if (self.redirectToServer())
            return self.navToServerBrowser();

        if (self.redirectToCustomGame())
            return self.navToCustomGame();

        if (self.redirectToReplay())
            return self.navToReplayBrowser();

        if (self.redirectToGalacticWar())
            return self.navToGalacticWar();

        if (self.redirectToAISkirmish())
            return self.navToAISkirmish();

        if (self.redirectToMatchMaking())
            return self.startMatchMaking();
    }

    self.showCredits = function () {
        $(".div_credits_dialog").dialog({ autoOpen: true, height: 'auto', position: {  my: "top", at: "top", of: window }} );
        $('.ui-widget-overlay').on("click", function() {
            $(".div_credits_dialog").dialog("close");
            $('.ui-widget-overlay').off("click");
        });
    };
    self.launchCredits = function () {
        self.galacticWarMode('credits');
        self.navToGalacticWar();
    };

    self.showKickstarters = function () {
        $(".div_kickstarter_dialog").dialog('open');
        $('.ui-widget-overlay').on("click", function() {
            $(".div_kickstarter_dialog").dialog("close");
            $('.ui-widget-overlay').off("click");
        });
    }

    self.hasShownOfflinePlayDialog = ko.observable(false).extend({ local: 'hasShownOfflinePlayDialog' });
    self.maybeShowOfflinePlayDialog = function() {
        // 32-bit users.
        if (!self.localServerAvailable())
        {
            if (!self.hasShownOfflinePlayDialog())
            {
                self.hasShownOfflinePlayDialog(true);
                $('#offlineUnavailable').modal('show');
            }
            return;
        }

        var setting = self.localServerSetting();
        if (setting === 'OFF' || setting === 'ON' || self.localServerRecommended())
        {
            self.hasShownOfflinePlayDialog(false);
            return;
        }

        if (!self.hasShownOfflinePlayDialog())
        {
            self.hasShownOfflinePlayDialog(true);
            $('#offlineInitiallyDisabled').modal('show');
        }
    };

    self.openOfflineUnavailableMoreInfo = function () {
        engine.call('web.launchPage', 'https://support.planetaryannihilation.com/kb/?a=search&q=Offline+Play+Disabled');
        $("#offlineUnavailable").modal('hide');
        $("#offlineInitiallyDisabled").modal('hide');
    };

    self.enableOfflinePlay = function() {
        self.localServerSetting('ON');
        api.settings.save();
        $("#offlineInitiallyDisabled").modal('hide');
    };

    self.graphicsVendorDescription = ko.pureComputed(function() {
        var vendor = self.graphicsVendor();
        if (vendor === "amd")
            return "AMD/ATI";
        if (vendor === "intel")
            return "Intel";
        if (vendor === "nvidia")
            return "NVIDIA";
        return null;
    });

    self.graphicsVendorDriverWebsite = ko.pureComputed(function() {
        var vendor = self.graphicsVendor();
        if (vendor === "amd" || vendor === "amdati" )
            return "http://support.amd.com/en-us/download";
        if (vendor === "intel")
            return "https://downloadcenter.intel.com/";
        if (vendor === "nvidia")
            return "http://www.nvidia.com/Download/index.aspx?lang=en-us";
        return null;
    });

    $("#graphicsDriverCrash").modal();
    $("#graphicsDriverCrash").on('hidden.bs.modal', function (e) {
        api.game.clearCrashReason();
        self.maybeShowOfflinePlayDialog();
    });

    self.maybeShowCrashDialog = function() {
        api.game.getCrashReason().then(function(reason) {
            if (reason === 'opengl_driver' && self.graphicsVendorDriverWebsite() !== null)
                $("#graphicsDriverCrash").modal('show');
            else
            {
                api.game.clearCrashReason();
                self.maybeShowOfflinePlayDialog();
            }
        })
        .fail(function() {
            self.maybeShowOfflinePlayDialog();
        });
    };

    self.openGraphicsVendorWebsite = function() {
        engine.call('web.launchPage', self.graphicsVendorDriverWebsite());
    };

    self.openForumWebsite = function()
    {
        engine.call('web.launchPage', 'https://forums.planetaryannihilation.com/');
    };

    self.communityTabGroup = ko.observable('news').extend({ local: 'community_tab_group' });

    self.clearCommunityTabGroup = function()
    {
        self.communityTabGroup(null);
    };

    self.showingNewsTab = ko.pureComputed(function()
    {
        return self.communityTabGroup() == 'news';
    });

    self.showUpdate = self.showingNewsTab;

    self.toggleNewsTab = function()
    {
        if (self.showingNewsTab())
            self.communityTabGroup(null);
        else
            self.communityTabGroup('news');
    };

    self.toggleUpdateTab = self.toggleNewsTab;

    self.openOfficialSupport = function ()
    {
        engine.call( 'web.launchPage', 'https://support.planetaryannihilation.com/' );
    }

    self.openOfficialGuides = function ()
    {
        engine.call( 'web.launchPage', 'https://planetaryannihilation.com/guides/' );
    }

    self.openOfficialDiscord = function()
    {
        engine.call( 'web.launchPage', 'https://discord.gg/pa' );
    }

    self.newsReady = ko.observable(false);
    self.hasUpdatePost = self.newsReady;

    self.newsTitle = ko.observable();
    self.updateTitle = self.newsTitle;

    self.newsUrl = ko.observable();
    self.updateUrl = self.newsUrl;

    self.newsAuthor = ko.observable();
    self.updateAuthor = self.newsAuthor;

    self.newsDate = ko.observable();
    self.updateDate = self.newsDate;

    self.openNewsUrl = function(e)
    {
        var url = self.newsUrl();

        if (url)
            engine.call( 'web.launchPage', url );

        return false;
    }

    self.openUpdateUrl = self.openNewsUrl;

    self.processNewsContent = function(html)
    {
        var content = $.parseHTML(html);

        $(content).find('a').each(function ()
        {
            $(this).click(function ()
            {
                if (this.href)
                    engine.call('web.launchPage', this.href);
                return false;
            });
        });

        return content;
    }

    self.fetchNews = function()
    {
        $.ajax({
            type: "GET",
            url:  "https://mods.planetaryannihilation.net/news.json",
            contentType: "application/json",
            success: function (data, textStatus)
            {
                if (data && _.isArray(data) && data.length)
                {
                    var news = data[0];

                    if (news)
                    {
                        self.newsTitle(news.title);
                        self.newsUrl(news.url);
                        self.newsAuthor('PA');

                        $('#news .news-content').html(self.processNewsContent(news.content));

                        var date = new Date(news.timestamp);

                        self.newsDate(date.toDateString());
                    }
                }
                self.newsReady(true);
            },
            error: function ()
            {
                console.error('fetchNews failed');
                self.newsReady(true);
            }
        });
    }

    self.fetchPatchNews = self.fetchNews;

    self.modalBack = function () {
        api.Panel.message(api.Panel.parentId, "finish_video");
    }

    self.playIntroVideo = function () {
        engine.call('audio.pauseMusic', true);
        api.Panel.message(api.Panel.parentId, 'play_intro');
    };

    self.localServerSetting = ko.observable().extend({ setting: { 'group': 'server', 'key': 'local' } });
    self.localServerDisabledInSettings = ko.pureComputed(function () {
        return self.localServerSetting() === 'OFF';
    });

    self.showOfflineWarning = ko.pureComputed(function() {
        /* Don't show it before we have gotten initialized. */
        if (!self.readyToLogin())
            return false;
        /* Don't show it while we're logging in. */
        if (self.showConnecting())
            return false;

        /* If we're logged on to Ubernet, then we are able to play. */
        if (self.allowUbernetActions())
            return false;

        /* Otherwise, if we can use the offline server, then we are able to play. */
        return !self.useLocalServer();
    });

    self.squelchTitansUpsellPage = ko.observable(false).extend({ local: 'squelch_titans_upsell' });

    self.showBuyTitans = ko.computed(function ()
    {
        // if (!self.allowMicroTransactions())
        //     return false;

        // if (self.squelchTitansUpsellPage())
        //     return false;

        return !api.content.ownsTitans() && !api.steam.accountOwnsTitans();
    });

    self.launchTitansAndExit = function()
    {
        api.steam.launchContent('PAExpansion1').then(function()
        {
            engine.call('exit');
        });
    };

    self.physicalCores = ko.observable(0).extend({ session: 'physical_cores' });
    self.physicalMemory = ko.observable(0).extend({ session: 'physical_memory' });

    self.noMods = ko.observable(false).extend({ session: 'nomods' });

    self.setup = function ()
    {
        var initialContent = api.content.active();

        var lastActiveContent = ko.observable().extend({ session: 'last_active_content'});

        api.content.active.subscribe(function(newContent)
        {
            lastActiveContent(newContent);
            if (newContent !== initialContent)
                api.game.debug.reloadScene(api.Panel.pageId);
        });

        if (lastActiveContent() != api.content.active())
        {
            lastActiveContent(api.content.active());
            $('#logo-background').css('background-image', $('#logo-background').css('background-image'));
        }

        self.isLocalGame(false);

        api.file.unmountAllMemoryFiles();
        api.game.setUnitSpecTag('');
        engine.call('reset_game_state');

        engine.call("audio.setVideoVolumeScale", 0.5);

        api.ar_system.changeSkyBoxSpec(api.settings.getSynchronous('graphics', 'skybox'));

        var needsLogin = !self.signedInToUbernet() && (self.hasCmdLineTicket() || self.useSteam());
        if (!self.hasSetupInfo() || needsLogin)
        {
            api.game.getSetupInfo().then(function (payload)
            {
                self.setupInfo(payload);
                self.hasSetupInfo(true);
                self.physicalCores(payload.cores);
                self.physicalMemory(payload.memory);
                self.noMods(!!payload.nomods);
                self.uiOptions(parseUIOptions(payload.ui_options));
                self.buildVersion(payload.version);
                self.buildVersionLocal(payload.version);
                self.os(payload.os);
                self.graphicsVendor(payload.graphics_vendor);
                self.useUbernetdev(payload.use_ubernetdev);
                self.localServerAvailable(payload.local_server_available);
                self.localServerRecommended(payload.local_server_recommended);

                self.hasCmdLineTicket(payload.has_cmdline_ticket);
                api.steam.hasClient(!!payload.has_steam);
                self.isSteamClientOnline(!!payload.steam_online);

                self.allowMicroTransactions(!!payload.allow_micro_transactions);
                self.microTransactionsAvailable(!!payload.micro_transactions_available);

                self.signedInToUbernet(false);

                if (self.hasCmdLineTicket() || self.useSteam())
                    self.ubernetLoginIn();
                self.mode(1);

                api.settings.load(true /* force */, false /* local */).then(function () {
                    api.settings.apply(['graphics', 'audio', 'camera', 'ui', 'server']);
                    UIMediaUtility.startMusic();
                });

                if (payload.username)
                    self.uberName(payload.username);

                self.readyToLogin(true);

                self.maybeShowCrashDialog();
            });
            engine.call('request_display_mode');
        }
        else
        {
            UIMediaUtility.startMusic();

            self.readyToLogin(true);
            self.maybeShowCrashDialog();
        }

        $("#signin, #reconnect, #abandon").button();

        self.lastSceneUrl('coui://ui/main/game/start/start.html');

        self.fetchStableBuild();
        self.fetchNews();

        self.stableBuildTimer = setInterval(self.fetchStableBuild, 60000);
        self.regionsTimer = setInterval(self.requestRegions, 60000);

        api.Panel.message('uberbar', 'lobby_info' /*, undefined */);
        api.Panel.message('uberbar', 'lobby_status', '');
        api.Panel.message('uberbar', 'visible', { value: true });

        if (!!$.url().param('startMatchMaking'))
            self.startMatchMaking({ skip_existing_game_check: true });

        api.Panel.message(gPanelParentId, 'hide_splash', true);
    };

    self.customServersUrl = ko.observable().extend({session: 'custom_servers_url'});
    self.customServersRefresh = ko.observable().extend({session: 'custom_servers_refresh'});
    self.customServersRetry = ko.observable().extend( {session: 'custom_servers_retry'});

    $.getJSON('https://cdn.palobby.com/api/servers/config/').done(function(data) {
        self.customServersUrl(data.url);
        self.customServersRefresh(data.refresh || 5000);
        self.customServersRetry(data.retry || 30000);
    });

    self.reconnectToGameInfo = ko.observable().extend({ local: 'reconnect_to_game_info' });

    self.reconnectToGameInfoMaxAge = ko.observable( 5 * 60 * 1000 );

    self.canDirectReconnect = ko.computed( function() {
        var reconnectToGameInfo = self.reconnectToGameInfo();

        if ( !reconnectToGameInfo ) {
            return false;
        }

        var allowUbernetActions = self.allowUbernetActions();
        var serverType = reconnectToGameInfo.type;
        var serverSetup = reconnectToGameInfo.setup;
        var gameType = reconnectToGameInfo.game;

        if (gameType == 'Galactic War' || serverSetup == 'replay' || serverSetup == 'loadsave') {
            return false;
        }

// must be logged in for ranked and uber servers

        if ( !allowUbernetActions && ( serverType == 'uber' )) {
            return false;
        }

        var uberId = reconnectToGameInfo.uberId;

// must be same user

        if ( uberId && self.uberId() != uberId ) {
            return false;
        }

        var timestamp = reconnectToGameInfo.timestamp;

// ignore and reset if older than reconnectToGameInfoMaxAge
        if ( timestamp && timestamp < ( Date.now() - self.reconnectToGameInfoMaxAge() ) ) {
            self.reconnectToGameInfo(undefined);
            return false;
        }

        setTimeout( function() { self.reconnectToGameInfo.valueHasMutated() }, 5000 );

        return true;
    });

    self.directReconnect = function() {
console.log(JSON.stringify(self.reconnectToGameInfo()));

        if ( !self.canDirectReconnect() ) {
            return;
        }

        var reconnectToGameInfo = self.reconnectToGameInfo();

        self.lobbyId( reconnectToGameInfo.lobby_id );
        self.uuid( reconnectToGameInfo.uuid );
        self.reconnectContent( reconnectToGameInfo.content );
        self.serverType( reconnectToGameInfo.type );

        self.gameHostname( reconnectToGameInfo.game_hostname );
        self.gamePort( reconnectToGameInfo.game_port );

        self.gameModIdentifiers( reconnectToGameInfo.mods );

        self.privateGamePassword( reconnectToGameInfo.password );

        var params = {
            content: self.reconnectContent(),
        };
        window.location.href = 'coui://ui/main/game/connect_to_game/connect_to_game.html?' + $.param(params);
    };

    self.promotions = {};

    self.events = ko.observable({}).extend({session: 'event_data'});

    self.fetchEvents = function()
    {
        $.getJSON('https://services.planetaryannihilation.net/messages/', function(data)
        {
            if (!_.isArray(data))
                return;

            _.forEach(data, function(event)
            {
                if (_.isString(event.start))
                    event.start = new Date(event.start).getTime();

                if (_.isString(event.finish))
                    event.finish = new Date(event.finish).getTime();
            })

            self.events(data);
        });
    }

    self.fetchEventsTimer = setInterval( self.fetchEvents, 60 * 1000 );

    self.fetchEvents();

    self.activeEvents = ko.observableArray([]);

    self.updateActiveEvents = function()
    {
        var events = self.events() || [];

        var messages = [];

        var titans = api.content.ownsTitans();

        _.forEach(events, function(event, key)
        {
            // apply any classic overrides

            if ( ! titans && event.classic )
                event = _.assign( {}, event, event.classic );

            var from = event.from;
            var showStart = event.showStart;

            var start = event.start;
            var finish = event.finish;

            var show = titans ? event.showTitans : event.showClassic;

            var now = Date.now();

            var activeStart = start - event.startingSeconds * 1000;

            var done = ! show || (finish && now > finish);

            var earlyExit = done || ( from && now < from ) || ( ! showStart && now < activeStart );

            if ( earlyExit )
                return;

            var delta = false;
            var status = false;
            var timer = false;

            var link = event.link;

            var active = now >= activeStart;

            if (active)
            {
                if (event.active)
                    event = _.assign( {}, event, event.active );

                if (event.showLive && event.stream)
                {
                    if (now < start)
                        delta = start - now;

                    if (event.stream)
                        link = event.stream;

                    status = loc('LIVE ');
                }
                else if (event.showEnd && finish)
                {
                    delta = finish - now;
                    status = loc('!LOC:ending in') + ' ';
                }
            }
            else
            {
                delta = start - now;
                status = loc('!LOC:starting in') + ' ';
            }

            var text = loc(event.text);
            var icon = event.icon;
            var streamIcon = event.streamIcon;
            var stream = event.stream;
            var streamTooltip = loc(event.streamTooltip) || '';

            if (delta)
            {
                var seconds = delta / 1000;

                var days = Math.floor( seconds / 86400 );

                var hours = Math.floor( seconds / 3600 );

                if ( hours < 10 )
                    hours = '0' + hours;

                var minutes = Math.floor( seconds / 60 % 60 );

                if ( minutes < 10 )
                    minutes = '0' + minutes;

                var seconds = Math.floor( seconds % 60 );

                if ( seconds < 10 )
                    seconds = '0' + seconds;

                timer  = days > 1 ? days + ' ' + loc('!LOC:days') : ( hours > 0 ? hours + ':' : '') + minutes + ':' + seconds;
            }

            var message =
            {
                text: text,
                link: link,
                status: status,
                timer: timer,
                icon: icon,
                streamIcon: streamIcon,
                stream: stream,
                streamTooltip: streamTooltip
            }

            messages.push(message);
        });

        self.activeEvents(messages);
    }

    self.updateActiveEventsTimer = setInterval( self.updateActiveEvents, 1000 );

    self.updateActiveEvents();

    self.eventClicked = function(data, event)
    {
        var link = data.link;

        if ( link )
            engine.call( 'web.launchPage', link );
    }

    self.eventStreamClicked = function(data)
    {
        var link = data.stream;

        if ( link )
            engine.call( 'web.launchPage', link );
    }
}

model = new LoginViewModel();

handlers = {};

handlers.display_mode = function (payload) {

    switch (payload.mode) {
        case 'FULLSCREEN': model.displayMode('FULLSCREEN');
        case 'WINDOWED': model.displayMode('WINDOWED');
        default: model.displayMode('WINDOWED');
    }
}

handlers.display_name = function (payload) {
    if (payload.display_name)
        model.displayName(payload.display_name);
}

handlers.video_complete = function () {
    model.introVideoComplete();
}

handlers.gog_auth_complete = function (payload) {
    console.log('gog_auth_complete');
    console.log(payload);

    model.gogId(payload.gog_id);
    model.gogPersonaName(payload.persona_name);
    model.accountCreationPopup.username(model.gogPersonaName());

    if (!model.hasEverSignedIn())
        model.openAccountCreationPopup();
}

//initalize dialogs
$(".div_credits_dialog").dialog({
    width: '100%',
    height: '100%',
    modal: true,
    autoOpen: false,
    dialogClass: 'credits_wrapper'
});

$(".div_kickstarter_dialog").dialog({
    width: '100%',
    height: '100%',
    modal: true,
    autoOpen: false,
    dialogClass: 'credits_wrapper'
});


var CmdButtons = {};
CmdButtons[loc("!LOC:OK")] = function () {
    $(this).dialog("close");
    model.showError(false);
    model.mode(1);
};
$("#error").dialog({
    dialogClass: "signin_notification",
    draggable: false,
    resizable: false,
    width: 600,
    modal: true,
    autoOpen: false,
    buttons: CmdButtons
});

$("#connecting").dialog({
    dialogClass: "signin_notification",
    draggable: false,
    resizable: false,
    height: 100,
    width: 500,
    modal: true,
    autoOpen: false,
    buttons: {}
});

CmdButtons = {};
CmdButtons[loc("!LOC:RECONNECT")] = function () {
    $(this).dialog("close");
    console.log("reconnect");
    model.rejoinGame();
};
CmdButtons[loc("!LOC:ABANDON")] = function () {
    console.log("abandon");
    model.abandon();
    model.showReconnect(false);
    $(this).dialog("close");
};
$("#reconnectDlg").dialog({
    dialogClass: "no-close",
    draggable: false,
    resizable: false,
    width: 600,
    modal: true,
    autoOpen: false,
    complete: function (data, textStatus) {
        model.showReconnect(false);
    },
    buttons: CmdButtons
});

CmdButtons = {};
CmdButtons[loc("!LOC:EXIT")] = function () {
    model.exit();
},
CmdButtons[loc("!LOC:LATER")] = function () {
    $(this).dialog("close");
    model.showNewBuild(false);
}
$(".div_build_number_dialog").dialog({
    dialogClass: "no-close",
    draggable: false,
    resizable: false,
    height: 400,
    width: 600,
    modal: true,
    autoOpen: false,
    closeOnEscape: false,
    buttons: CmdButtons
});

CmdButtons = {};
CmdButtons[loc("!LOC:OK")] = function () {
    $(this).dialog("close");
    model.finishRegionSetup();
}
$("#regionDlg").dialog({
    dialogClass: "no-close",
    draggable: false,
    resizable: false,
    height: 450,
    width: 550,
    modal: true,
    autoOpen: false,
    closeOnEscape: false,
    buttons: CmdButtons
});

if ( window.CommunityMods ) {
    try {
        CommunityMods();
    } catch ( e ) {
        console.error( e );
    }
}

loadSceneMods('start');

// setup send/recv messages and signals
app.registerWithCoherent(model, handlers);

// Activates knockout.js
ko.applyBindings(model);

model.setup();
