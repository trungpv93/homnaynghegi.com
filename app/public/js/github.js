/**
 * @returns {{init: init, refresh: refresh}}
 * @constructor
 */
function HubTab() {

    var trendingRequest = false, // To make sure that there are no parallel requests
        repoGroupSelector = '.content-batch', // Batch of repositories
        filterSelector = '.repos-filter', // Selector that matches every repo filter on page
        mainContainer = '.main-content', // Main container div
        dateHead = '.date-head', // Heading item for the batch of repositories
        dateAttribute = 'date', // Date attribute on the date head of batch
        // token = 'a1a420cbad0a4d3eccda',    // API token. Don't grin, it's a dummy
        languageFilter = '#language', // Filter for repositories language
        dateFilter = '#date-hunt', // Date jump filter i.e. weekly, monthly or yearly
        tokenStorageKey = 'githunt_token', // Storage key for the github token
        requestCount = 0, // Track the count of how many times the refresh was tried
        reposApiUrl = 'https://api.github.com/search/repositories';

    /**
     * Generates the HTML for batch of repositories
     * @param repositories
     * @param lowerDate
     * @param upperDate
     * @returns {string}
     */
    function generateReposHtml(repositories, lowerDate, upperDate) {
        var html = '';

        $i = 0;
        $(repositories).each(function(index, repository) {
            // Make the name and description XSS safe
            var repFullName = $('<div>').text(repository.full_name).html();
            var repFullDesc = $('<div>').text(repository.description).html();

            if (repFullDesc === '') {
                repFullDesc = '<i>No description or website provided</i>';
            }

            if ($i % 2 === 0) {
                html += '<div class="row">';
            }

            html += '<div class="col-md-6">';
            html += '<div class="well well-sm repo-box">';
            html += '<div class="row">';
            html += '<div class="col-xs-3 col-sm-3 col-lg-3 col-md-3 text-center">';
            html += '<img src="' + repository.owner.avatar_url + '" alt="bootsnipp" class="img-rounded img-responsive" />';
            html += '</div>';
            html += '<div class="col-xs-9 col-sm-9 col-lg-9 col-md-9 section-box">';
            html += '<a href="' + repository.html_url + '" target="_blank"><h4>';
            html += repFullName + ' <span class="glyphicon glyphicon-new-window">';
            html += '</span>';
            html += '</h4></a>';
            html += '<p>';
            html += repFullDesc + '</p>';
            html += '<hr />';
            html += '<div class="row rating-desc">';
            html += '<div class="col-xs-12 col-sm-12 col-lg-12 col-md-12">';
            html += '<i class="fa fa-code-fork"></i> ' + repository.forks_count + '<span class="separator">|</span>';
            html += '<i class="fa fa-commenting-o"></i> ' + repository.open_issues + '<span class="separator">|</span>';
            html += '<i class="fa fa-star"></i> ' + repository.stargazers_count;
            html += '</div>';
            html += '</div>';
            html += '</div>';
            html += '</div>';
            html += '</div>';
            html += '</div>';
            if ($i % 2 !== 0) {
                html += '</div>';
            }
            $i++;
        });

        var humanDate = moment(lowerDate).fromNow(),
            formattedLower = moment(lowerDate).format('ll'),
            formattedUpper = moment(upperDate).format('ll');

        var finalHtml = '<div class="row content-batch"><div class="col-md-12"><h3 class="date-head" data-date="' + lowerDate + '">' + humanDate + ' - ' + formattedLower + ' &ndash; ' + formattedUpper + '</h3>' + html + '<div class="clearfix"></div></div></div></div>';

        return finalHtml;
    }

    /**
     * Gets the next date range for which repositories need to be fetched
     * @returns {{}}
     */
    var getNextDateRange = function() {

        // Lower limit for when the last repos batch was fetched
        var lastFetched = $(repoGroupSelector).last().find(dateHead).data(dateAttribute),
            dateRange = {},
            dateJump = $(dateFilter).val();

        if (lastFetched) {
            dateRange.upper = lastFetched;
            dateRange.lower = moment(lastFetched).subtract(1, dateJump).format('YYYY-MM-DD');
        } else {
            dateRange.upper = moment().format('YYYY-MM-DD');
            dateRange.lower = moment().add(1, 'day').subtract(1, dateJump).format('YYYY-MM-DD');
        }

        return dateRange;
    };

    /**
     * Gets the filters to be passed to API
     * @returns {{queryParams: string, dateRange: {}}}
     */
    var getApiFilters = function() {
        var dateRange = getNextDateRange(),
            language = $(languageFilter).val(),
            langCondition = '';

        // If language filter is applied, populate the language
        // chunk to put in URL
        if (language) {
            langCondition = 'language:' + language + ' ';
        }

        // If user has set the github token in storage pass that
        // alongside the request.
        var apiToken = '&access_token=' + GITHUB_API_KEY;

        return {
            queryParams: '?sort=stars&order=desc&q=' + langCondition + 'created:"' + dateRange.lower + ' .. ' + dateRange.upper + '"' + apiToken,
            dateRange: dateRange
        };
    };

    /**
     * Saves the hunt result in localstorage to avoid requests on each tab change
     */
    var saveHuntResult = function() {

        var huntResults = $('.main-content').html();
        if (!huntResults) {
            return false;
        }
    };


    /**
     * Fetches the trending repositories based upon the filters applied
     * @returns {boolean}
     */
    var fetchTrendingRepos = function() {

        // If there is some request, already in progress or there was
        // an error, do not allow further requests.
        if ((trendingRequest !== false) || ($('.error-quote').length !== 0)) {
            return false;
        }

        var total_count = 0;

        var filters = getApiFilters(),
            url = reposApiUrl + filters.queryParams;

        trendingRequest = $.ajax({
            url: url,
            method: 'get',
            beforeSend: function() {
                $('.loading-more').removeClass('hide');
            },
            success: function(data) {
                var finalHtml = generateReposHtml(data.items, filters.dateRange.lower, filters.dateRange.upper);
                $(mainContainer).append(finalHtml);
                total_count = data.total_count;
            },
            error: function(xhr, status, error) {
                var error = JSON.parse(xhr.responseText),
                    message = error.message || '';

                if (message && message.toLowerCase() == 'bad credentials') {
                    $('.main-content').replaceWith('<h3 class="quote-item error-quote">Oops! Seems to be a problem with your API token. Could you verify the API token you.</h3>');

                } else if (message && (message.indexOf('rate limit') !== -1)) {
                    $('.main-content').replaceWith('<h3 class="quote-item error-quote">Oops! Seems like you did not set the API token. Wait another hour for github to refresh your rate limit.</h3>');
                } else {
                    $('.main-content').replaceWith('Oops! Could you please refresh the page.');
                }
            },
            complete: function() {
                trendingRequest = false;
                $('.loading-more').addClass('hide');

                saveHuntResult();

                if (total_count == 0) {
                    // Refresh the repositories
                    fetchTrendingRepos();
                }
            }
        });
    };

    /**
     * Perform all the UI bindings
     */
    var bindUI = function() {

        // Bind the scroll to fetch repositories when bottom reached
        $(window).on('scroll', function() {
            if ($(window).scrollTop() + $(window).height() > $(document).height() - 100) {
                fetchTrendingRepos();
            }
        });

        // On change of repository filters
        $(document).on('change', filterSelector, function() {

            // Increase the request count so that refresh is enabled
            requestCount++;

            // Remove the existing fetches repositories
            $(repoGroupSelector).remove();

            // Refresh the repositories
            fetchTrendingRepos();
        });
    };

    return {

        /**
         * initialize the hub page
         */
        init: function() {
            bindUI();
            this.refresh();
        },

        /**
         * Refresh the listing and filters
         */
        refresh: function() {
            fetchTrendingRepos();
        }
    };
}

$(function() {
    var hubTab = new HubTab();
    hubTab.init();
});
