(function (root) {
    function partitionSprintSections(sections) {
        return sections.reduce((result, section) => {
            const target = section.percentComplete === 100 ? result.completed : result.active;
            target.push(section);
            return result;
        }, { active: [], completed: [] });
    }

    function partitionBacklogItems(items) {
        return partitionSprintSections(items);
    }

    const api = { partitionSprintSections, partitionBacklogItems };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    root.WorkBacklogHelpers = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
