const { dataCollectionJobService } = require('../jobs/data-collection-job.service')

async function executeAdhocDataCollection(brandId, customerId, options = {}) {
  const {
    collectors,
    locale,
    country,
    since
  } = options

  return dataCollectionJobService.executeDataCollection(brandId, customerId, {
    collectors,
    locale,
    country,
    since,
    suppressScoring: true
  })
}

module.exports = {
  executeAdhocDataCollection
}

