Current View (quadrants → cards)
Inputs per source:
mentionRate (%), soa (%), sentiment (−1..1), citations (count normalized to max)
Medians: mentionMedian, soaMedian, sentimentMedian (median of normalized sentiment), citationsMedian
Composite score: mentionNorm*0.35 + soaNorm*0.35 + sentimentNorm*0.2 + citationsNorm*0.1
Composite cutoffs: compositeMedian, compositeTopQuartile (P75)
Rules (classifyQuadrant):
Priority Partnerships (priority): visibilityStrong & soaStrong & compositeStrong
visibilityStrong: mentionRate ≥ mentionMedian
soaStrong: soa ≥ soaMedian
compositeStrong: compositeScore ≥ compositeTopQuartile
Reputation Management (reputation): visibilityStrong AND (sentiment not positive OR citations not strong)
sentimentPositive: sentimentNorm ≥ sentimentMedian
citationsStrong: citationsNorm ≥ citationsMedian
Growth Opportunities (growth): NOT visibilityStrong AND (sentimentPositive OR citationsStrong) AND compositeHealthy
compositeHealthy: compositeScore ≥ compositeMedian
Monitor (monitor): everything else
New Zone View (zones → cards)
Inputs per source (converted to % where needed): mentionPct, soaPct, sentimentPct (normalized), citationsPct, composite score as above.
Cutoffs: scoreP75, scoreMedian, mentionMedian, soaMedian.
Rules (classifyNewZone):
Market Leaders: score ≥ scoreP75 AND sentimentPct ≥ 50 AND citationsPct ≥ 25
Reputation Risks: (mentionPct ≥ mentionMedian OR soaPct ≥ soaMedian) AND (sentimentPct < 50 OR citationsPct < 20) AND score < scoreP75
Growth Bets: score between scoreMedian and scoreP75 AND (sentimentPct ≥ 55 OR citationsPct ≥ 30) AND mentionPct < mentionMedian
Monitor & Improve: everything else
These are the heuristics/metrics driving the category cards you see (Priority Partnerships, Reputation Management, Growth Opportunities, Monitor in Current View; Market Leaders, Reputation Risks, Growth Bets, Monitor & Improve in New Zone View).