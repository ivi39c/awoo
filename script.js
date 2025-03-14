fetch('您的 products.json 檔案 URL') // 請替換成您的 JSON 檔案 URL
  .then(response => response.json())
  .then(products => {
    const productList = document.getElementById("product-list");
    const searchInput = document.getElementById("search-input");
    const categoryList = document.getElementById("category-list");
    const filterInfo = document.getElementById("filter-info");
    let currentCategory = "category1";
    let currentBrand = null;
    let currentTags = [];

    function renderProducts(productsToRender) {
      productList.innerHTML = "";
      productsToRender.forEach((product) => {
        const productCard = document.createElement("div");
        productCard.className = "product-card";
        productCard.innerHTML = `
          <div class="product-image-container">
            <img src="${product.圖片}" alt="${product.品名}" class="product-image" />
          </div>
          <h3 class="product-title">${product.廠商} ${product.品名}</h3>
          <p class="product-model">型號：${product.型號}</p>
          <div class="product-details">
            <p class="product-features">特色：${product.功能特色}</p>
            <p class="product-specifications">規格：${product.產品規格}</p>
            <div class="product-tags">
              ${product.tags.map(tag => `<span class="tag" data-tag="${tag}">${tag}</span>`).join("")}
            </div>
          </div>
        `;
        const details = productCard.querySelector(".product-details");
        details.style.display = "none";
        productCard.addEventListener("click", () => {
          details.style.display = details.style.display === "block" ? "none" : "block";
        });
        productList.appendChild(productCard);
      });

      // 新增標籤點擊事件監聽器
      const tagElements = productList.querySelectorAll(".tag");
      tagElements.forEach((tagElement) => {
        tagElement.addEventListener("click", (event) => {
          const clickedTag = event.target.dataset.tag;
          filterByTag(clickedTag);
        });
      });
    }

    function filterByTag(tag) {
      const filteredProducts = products.filter((product) => {
        return product.tags.includes(tag);
      });
      renderProducts(filteredProducts);
      filterInfo.textContent = `篩選條件：標籤 - ${tag}`;
    }

    function filterByCategory(category, brand, tags) {
      currentCategory = category;
      currentBrand = brand;
      currentTags = tags;
      let filteredProducts = products.filter((product) => {
        return product.category === category;
      });

      if (brand) {
        filteredProducts = filteredProducts.filter((product) => {
          return product.廠商 === brand;
        });
      }

      if (tags && tags.length > 0) {
        filteredProducts = filteredProducts.filter((product) => {
          return tags.every((tag) => product.tags.includes(tag));
        });
      }

      renderProducts(filteredProducts);
    }

    categoryList.addEventListener("click", (event) => {
      let target = event.target;

      // 向上尋找最近的 <li> 元素
      while (target && target.tagName !== "LI") {
        target = target.parentElement;
      }

      if (target) {
        const category = target.dataset.category;
        const brand = target.dataset.brand;

        if (brand) {
          filterByCategory(category, brand, currentTags);
          event.stopPropagation();
        } else {
          filterByCategory(category, null, currentTags);
        }
      }
    });

    searchInput.addEventListener("input", () => {
      const searchTerm = searchInput.value.toLowerCase();
      const filteredProducts = products.filter((product) => {
        return (
          product.品名.toLowerCase().includes(searchTerm) ||
          product.廠商.toLowerCase().includes(searchTerm) ||
          product.型號.toLowerCase().includes(searchTerm)
        );
      });
      renderProducts(filteredProducts);
    });

    filterByCategory(currentCategory, currentBrand, currentTags);
  });