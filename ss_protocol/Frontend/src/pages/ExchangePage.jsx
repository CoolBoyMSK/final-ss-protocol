import { useEffect } from "react";
import "../Styles/ExchangePage.css";

const CONNECTOR_SCRIPT_ID = "changenow-stepper-connector";

const ExchangePage = () => {
  useEffect(() => {
    if (document.getElementById(CONNECTOR_SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = CONNECTOR_SCRIPT_ID;
    script.defer = true;
    script.type = "text/javascript";
    script.src = "https://changenow.io/embeds/exchange-widget/v2/stepper-connector.js";
    document.body.appendChild(script);
  }, []);

  return (
    <section className="exchange-page container">
      <div className="exchange-layout row g-4 align-items-center">
        <div className="col-12 col-lg-5 exchange-left-col">
          <div className="exchange-hero">
            <h1 className="exchange-title mb-3">Buy PLS to Participate in Daily Auctions</h1>
            <p className="exchange-subtitle mb-4">
              Purchase PLS and fund your wallet to mint DAV, then Auctions
              across the State Protocol ecosystem.
            </p>

            <p className="exchange-note mb-0">
              Exchange execution, rates, and processing are provided by ChangeNOW.
            </p>
          </div>
        </div>

        <div className="col-12 col-lg-7">
          <iframe
            id="iframe-widget"
            src="https://changenow.io/embeds/exchange-widget/v2/widget.html?FAQ=true&amount=60&amountFiat&backgroundColor=212529&darkMode=true&from=usdterc20&horizontal=false&isFiat=false&lang=en-US&link_id=1ddf0f8f72f138&locales=false&logo=true&primaryColor=2575FC&to=pls&toTheMoon=false"
            style={{ height: "460px", width: "100%", border: "none" }}
            title="ChangeNOW Exchange Widget"
          />
        </div>
      </div>
    </section>
  );
};

export default ExchangePage;
