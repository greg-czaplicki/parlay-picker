"use strict";
// Types for PGA Tour stats scraping
Object.defineProperty(exports, "__esModule", { value: true });
exports.backupStatsCategoryUrls = exports.statsCategoryUrls = exports.StatsCategory = void 0;
exports.generateCourseIdFromName = generateCourseIdFromName;
// Stats categories to scrape from PGA Tour
var StatsCategory;
(function (StatsCategory) {
    StatsCategory["SG_TOTAL"] = "SG_TOTAL";
    StatsCategory["SG_OTT"] = "SG_OTT";
    StatsCategory["SG_APP"] = "SG_APP";
    StatsCategory["SG_ARG"] = "SG_ARG";
    StatsCategory["SG_PUTT"] = "SG_PUTT";
    StatsCategory["DRIVING_ACCURACY"] = "DRIVING_ACCURACY";
    StatsCategory["DRIVING_DISTANCE"] = "DRIVING_DISTANCE";
})(StatsCategory || (exports.StatsCategory = StatsCategory = {}));
// Map of stats categories to their PGA Tour URL paths
exports.statsCategoryUrls = {
    // Specific format: detail/statId URLs (recommended by user)
    [StatsCategory.SG_TOTAL]: 'https://www.pgatour.com/stats/detail/02675',
    [StatsCategory.SG_OTT]: 'https://www.pgatour.com/stats/detail/02567',
    [StatsCategory.SG_APP]: 'https://www.pgatour.com/stats/detail/02568',
    [StatsCategory.SG_ARG]: 'https://www.pgatour.com/stats/detail/02569',
    [StatsCategory.SG_PUTT]: 'https://www.pgatour.com/stats/detail/02564',
    [StatsCategory.DRIVING_ACCURACY]: 'https://www.pgatour.com/stats/detail/102',
    [StatsCategory.DRIVING_DISTANCE]: 'https://www.pgatour.com/stats/detail/101'
};
// Map of backup URLs in case primary ones don't work
exports.backupStatsCategoryUrls = {
    // Alternative format: stat/statId.html URLs
    [StatsCategory.SG_TOTAL]: 'https://www.pgatour.com/stats/stat/02675.html',
    [StatsCategory.SG_OTT]: 'https://www.pgatour.com/stats/stat/02567.html',
    [StatsCategory.SG_APP]: 'https://www.pgatour.com/stats/stat/02568.html',
    [StatsCategory.SG_ARG]: 'https://www.pgatour.com/stats/stat/02569.html',
    [StatsCategory.SG_PUTT]: 'https://www.pgatour.com/stats/stat/02564.html',
    [StatsCategory.DRIVING_ACCURACY]: 'https://www.pgatour.com/stats/stat/102.html',
    [StatsCategory.DRIVING_DISTANCE]: 'https://www.pgatour.com/stats/stat/101.html'
};
// Helper function to generate course ID from name
function generateCourseIdFromName(courseName) {
    if (!courseName)
        return '';
    // Remove non-alphanumeric characters and convert to lowercase
    const cleaned = courseName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    // Remove consecutive underscores
    const normalized = cleaned.replace(/_+/g, '_');
    // Trim underscores from start and end
    return normalized.replace(/^_|_$/g, '');
}
