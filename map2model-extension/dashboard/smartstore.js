// ========================================
// dashboard/smartstore.js — v10.0
// 네이버 스마트스토어 커머스 API 연동
// ========================================

class SmartStoreAPI {
  constructor(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.accessToken = null;
    this.tokenExpiry = 0;
  }

  // ── 인증 토큰 발급 ──
  async authenticate() {
    const timestamp = Date.now() - 3000; // 3초 보정 (서버와 동일)
    const password = `${this.clientId}_${timestamp}`;

    // bcryptjs 라이브러리 사용
    if (typeof dcodeIO !== 'undefined' && dcodeIO.bcrypt) {
      const bcrypt = dcodeIO.bcrypt;
      const hashed = bcrypt.hashSync(password, this.clientSecret);
      const signature = btoa(hashed);

      const params = new URLSearchParams({
        client_id: this.clientId,
        timestamp: timestamp.toString(),
        client_secret_sign: signature,
        grant_type: 'client_credentials',
        type: 'SELF'
      });

      const resp = await fetch(
        `https://api.commerce.naver.com/external/v1/oauth2/token?${params.toString()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(`토큰 발급 실패: ${err.message || resp.status}`);
      }

      const data = await resp.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in || 10800) * 1000;
      return;
    }

    throw new Error('bcrypt 라이브러리 로드 실패. dashboard.html에 bcrypt.min.js가 포함되어야 합니다.');
  }

  // ── 토큰 유효성 확인 ──
  async ensureToken() {
    if (!this.accessToken || Date.now() >= this.tokenExpiry - 60000) {
      await this.authenticate();
    }
  }

  // ── API 호출 헬퍼 ──
  async apiCall(method, path, body = null) {
    await this.ensureToken();
    const url = `https://api.commerce.naver.com/external${path}`;
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    };
    if (body) options.body = JSON.stringify(body);

    const resp = await fetch(url, options);

    // 401이면 토큰 재발급 후 재시도
    if (resp.status === 401) {
      await this.authenticate();
      options.headers['Authorization'] = `Bearer ${this.accessToken}`;
      const retry = await fetch(url, options);
      if (!retry.ok) {
        const err = await retry.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${retry.status}`);
      }
      return retry.json();
    }

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${resp.status}`);
    }
    return resp.json();
  }

  // ── 상품 데이터 구성 ──
  buildProductData({ name, description, detailHtml, images, sizes, categoryId, returnInfo }) {
    // 대표 이미지
    const representativeImage = images.length > 0 ? { url: images[0] } : null;

    // 옵션 이미지 (최대 10개)
    const optionalImages = images.slice(1, 10).map(url => ({ url }));

    // 사이즈 옵션
    const optionCombinations = sizes.map(s => ({
      optionName1: `${s.label} (${s.width}×${s.height}mm)`,
      stockQuantity: 999,
      price: s.price,
      usable: true
    }));

    // 기본 가격 (최저가)
    const basePrice = sizes.length > 0 ? Math.min(...sizes.map(s => s.price)) : 59000;

    return {
      originProduct: {
        statusType: 'SALE',
        saleType: 'NEW',
        leafCategoryId: categoryId || '50000803',
        name: name,
        detailContent: detailHtml,
        images: {
          representativeImage: representativeImage,
          optionalImages: optionalImages
        },
        salePrice: basePrice,
        stockQuantity: 999,
        deliveryInfo: {
          deliveryType: 'DELIVERY',
          deliveryAttributeType: 'NORMAL',
          deliveryFee: {
            deliveryFeeType: 'FREE',
            baseFee: 0
          },
          claimDeliveryInfo: {
            returnDeliveryFee: 5000,
            exchangeDeliveryFee: 5000
          }
        },
        detailAttribute: {
          naverShoppingSearchInfo: {
            modelId: null,
            manufacturerName: 'Map2Model',
            brandId: null
          },
          afterServiceInfo: {
            afterServiceTelephoneNumber: '010-0000-0000',
            afterServiceGuideContent: returnInfo || '주문 제작 상품입니다.'
          },
          purchaseQuantityInfo: {
            minPurchaseQuantity: 1,
            maxPurchaseQuantity: 0
          },
          originAreaInfo: {
            originAreaCode: '03',
            content: '대한민국'
          },
          seoInfo: {
            pageTitle: name,
            metaDescription: description?.substring(0, 150) || name
          }
        },
        customerBenefit: null
      }
    };

    // 옵션이 있는 경우 추가
    // (네이버 API는 옵션 구조가 복잡하므로 별도 설정 필요)
  }

  // ── 상품 등록 ──
  async createProduct(productData) {
    return this.apiCall('POST', '/v2/products', productData);
  }

  // ── 상품 이미지 업로드 ──
  async uploadImages(imageUrls) {
    // 네이버 자체 이미지 호스팅으로 업로드
    // 실제로는 multipart form 사용
    const results = [];
    for (const url of imageUrls) {
      try {
        const resp = await fetch(url);
        const blob = await resp.blob();
        const formData = new FormData();
        formData.append('imageFiles', blob, `product_${Date.now()}.jpg`);

        await this.ensureToken();
        const uploadResp = await fetch('https://api.commerce.naver.com/external/v1/product-images/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${this.accessToken}` },
          body: formData
        });

        if (uploadResp.ok) {
          const data = await uploadResp.json();
          if (data.images && data.images.length > 0) {
            results.push(data.images[0].url);
          }
        }
      } catch (e) {
        console.error('이미지 업로드 실패:', url, e);
      }
    }
    return results;
  }
}

// 전역으로 노출
window.SmartStoreAPI = SmartStoreAPI;
