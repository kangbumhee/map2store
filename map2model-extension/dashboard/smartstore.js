// ========================================
// dashboard/smartstore.js — v10.2
// 네이버 스마트스토어 커머스 API 연동
// oliveyoung-smart-store 검증된 구조 기반
// ========================================

class SmartStoreAPI {
  constructor(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.accessToken = null;
    this.tokenExpiry = 0;
  }

  // ── 인증 토큰 발급 (bcrypt 서명) ──
  async authenticate() {
    const timestamp = Date.now() - 3000;
    const password = `${this.clientId}_${timestamp}`;

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
        { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
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

    throw new Error('bcrypt 라이브러리 로드 실패');
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

    let resp = await fetch(url, options);

    // 401이면 토큰 재발급 후 재시도
    if (resp.status === 401) {
      await this.authenticate();
      options.headers['Authorization'] = `Bearer ${this.accessToken}`;
      resp = await fetch(url, options);
    }

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      // 상세 에러 로깅
      console.error('[SmartStore] API 에러:', {
        status: resp.status,
        message: errData.message,
        invalidInputs: errData.invalidInputs,
        detail: errData
      });
      const detail = errData.invalidInputs
        ? `\n누락 필드: ${JSON.stringify(errData.invalidInputs)}`
        : '';
      throw new Error(`${errData.message || `HTTP ${resp.status}`}${detail}`);
    }
    return resp.json();
  }

  // ── 상품 데이터 구성 (oliveyoung-smart-store 검증 구조) ──
  buildProductData({ name, description, detailHtml, images, sizes, categoryId, returnInfo, settings }) {
    // 설정값 (대시보드 설정에서 가져옴)
    const outboundCode = settings?.outboundShippingPlaceCode || 100797935;
    const returnAddressId = settings?.returnAddressId || 100797936;
    const shippingAddressId = settings?.shippingAddressId || 100797935;
    const sellerPhone = settings?.sellerPhone || '010-7253-0101';
    const deliveryCompany = settings?.deliveryCompany || 'CJGLS';

    // 대표 이미지
    const representativeImage = images.length > 0 ? { url: images[0] } : null;
    // 추가 이미지 (최대 4개)
    const optionalImages = images.slice(1, 5).map(url => ({ url }));

    // 기본 가격
    const basePrice = sizes.length > 0 ? Math.min(...sizes.map(s => s.price)) : 90000;

    // 사이즈 옵션
    let optionInfo = null;
    if (sizes.length > 1) {
      optionInfo = {
        optionCombinationSortType: 'CREATE',
        optionCombinationGroupNames: { optionGroupName1: '사이즈' },
        optionCombinations: sizes.map(s => ({
          optionName1: `${s.label} (${s.width}×${s.height}mm)`,
          stockQuantity: 999,
          price: s.price - basePrice, // 기본가 대비 추가금
          usable: true
        }))
      };
    }

    // 상품정보제공고시 (ETC 타입 - 3D 프린팅 모형)
    const productInfoProvidedNotice = {
      productInfoProvidedNoticeType: 'ETC',
      etc: {
        returnCostReason: '전자상거래등에서의소비자보호에관한법률 등에 의한 제품의 하자 또는 오배송 등으로 인한 청약철회의 경우에는 상품 수령 후 3개월 이내, 그 사실을 안 날 또는 알 수 있었던 날로부터 30일 이내에 청약철회를 할 수 있으며, 반품 배송비는 판매자가 부담합니다.',
        noRefundReason: '주문 제작 상품 특성상 제작 시작 후 단순 변심에 의한 취소/반품이 불가합니다. 제품의 하자가 있는 경우 수령 후 7일 이내 교환 가능합니다.',
        qualityAssuranceStandard: '소비자분쟁해결기준(공정거래위원회 고시)에 따라 피해를 보상받을 수 있습니다.',
        compensationProcedure: '주문취소 및 반품 시 환불은 주문취소 및 반품 완료 후 영업일 기준 2~3일 이내 처리됩니다.',
        troubleShootingContents: '소비자 분쟁해결 기준(공정거래위원회 고시)에 의거 처리합니다.',
        itemName: name,
        modelName: '3D 지형 모형 액자',
        certificateDetails: '해당없음',
        manufacturer: 'Map2Model',
        customerServicePhoneNumber: sellerPhone
      }
    };

    // detailAttribute
    const detailAttribute = {
      afterServiceInfo: {
        afterServiceTelephoneNumber: sellerPhone,
        afterServiceGuideContent: returnInfo || '주문 제작 상품입니다. 제품 수령 후 파손이나 하자가 있는 경우 네이버 톡톡으로 문의해주세요.'
      },
      originAreaInfo: {
        originAreaCode: '03',
        content: '상세설명에 표시',
        importer: '상세페이지 참조'
      },
      productInfoProvidedNotice: productInfoProvidedNotice,
      certificationTargetExcludeContent: {
        childCertifiedProductExclusionYn: true,
        kcCertifiedProductExclusionYn: 'TRUE',
        greenCertifiedProductExclusionYn: true
      },
      minorPurchasable: true,
      seoInfo: {
        pageTitle: name,
        metaDescription: description?.substring(0, 150) || name
      },
      purchaseQuantityInfo: {
        minPurchaseQuantity: 1,
        maxPurchaseQuantity: 0
      }
    };

    // 옵션이 있으면 detailAttribute에 추가
    if (optionInfo) {
      detailAttribute.optionInfo = optionInfo;
    }

    // 최종 payload
    const payload = {
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
          deliveryCompany: deliveryCompany,
          outboundShippingPlaceCode: outboundCode,
          deliveryFee: {
            deliveryFeeType: 'FREE',
            baseFee: 0,
            deliveryFeePayType: 'PREPAID'
          },
          claimDeliveryInfo: {
            returnDeliveryFee: 5000,
            exchangeDeliveryFee: 5000,
            shippingAddressId: shippingAddressId,
            returnAddressId: returnAddressId
          }
        },
        detailAttribute: detailAttribute
      },
      smartstoreChannelProduct: {
        naverShoppingRegistration: true,
        channelProductDisplayStatusType: 'ON'
      }
    };

    return payload;
  }

  // ── 상품 등록 ──
  async createProduct(productData) {
    return this.apiCall('POST', '/v2/products', productData);
  }

  // ── 이미지 업로드 (URL → 네이버 호스팅) ──
  async uploadImages(imageUrls) {
    const results = [];
    for (const url of imageUrls.slice(0, 5)) {
      try {
        const imgResp = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (!imgResp.ok) continue;
        const blob = await imgResp.blob();
        if (blob.size < 1000) continue;

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
        console.error('[SmartStore] 이미지 업로드 실패:', url, e);
      }
    }
    return results;
  }
}

window.SmartStoreAPI = SmartStoreAPI;
