import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score

from clusterer.utils import calculate_dimensions

def K_Means(orig_data, dimensions, k=0):

    if not dimensions or not dimensions[0] or dimensions[0]=='':
        return [{'error': 'no dimensions'}], {}

    # For each data object, calculate the value of each dimension. E.g. convert
    # (grossProfit + totalRevenue) / totalRevenue --> 1.747.... for each object
    orig_data = calculate_dimensions(orig_data, dimensions)
    n = len(orig_data)
    m = len(dimensions)

    if n == 0:
        return [{'error': 'no data with given dimensions found'}], {}
    if k > n:
        return [{'error': 'k>n. Amount of clusters cannot exceed amount of data points.'}], {}
    if n < 10 and k == 0:
        return [{'error': 'Not enough data points to automatically determine k'}], {}

    X = np.zeros((n, m))
    for i in range(n):
        for j in range(m):
            X[i,j] = orig_data[i][f'dimension{j+1}']
    scaler = StandardScaler()
    data_scaled = scaler.fit_transform(X)

    # If the user has not selected the number of clusters, we determine it
    silhouette_coeff = -np.inf
    if k==0:
        for i in range(2, 11):
            k_means = KMeans(n_clusters=i, init = 'k-means++', n_init='auto')
            k_means.fit(data_scaled)
            score = silhouette_score(data_scaled, k_means.labels_)
            if score > silhouette_coeff:
                silhouette_coeff = score
                k = i

    k_means = KMeans(n_clusters = k, init = 'k-means++', n_init='auto')
    y = k_means.fit_predict(data_scaled)
    metrics = {}
    if np.isinf(silhouette_coeff):
        metrics['silhouette_score'] = silhouette_score(data_scaled, k_means.labels_)
    else:
        metrics['silhouette_score'] = silhouette_coeff

    for i in range(n):
        orig_data[i]['cluster'] = str(y[i])

    return orig_data, metrics
