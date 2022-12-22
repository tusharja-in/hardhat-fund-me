const { assert, expect } = require("chai");
const { deployments, ethers, getNamedAccounts } = require("hardhat");

describe("FundMe", function() {
    let fundMe;
    let deployer;
    let mockV3Aggregator;
    const sendValue = ethers.utils.parseEther("1");
    beforeEach(async function() {
        //deploy contract
        //this will help to run deploy .js files which have ["all"] tag in it.
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture(["all"]);
        fundMe = await ethers.getContract("FundMe", deployer);
        mockV3Aggregator = await ethers.getContract(
            "MockV3Aggregator",
            deployer
        );
    });

    describe("constructor", async function() {
        it("sets the aggregator address correctly", async function() {
            const response = await fundMe.s_priceFeed();
            assert.equal(response, mockV3Aggregator.address);
        });
    });
    describe("fund", async function() {
        it("fails it you dont send enough ETH", async function() {
            await expect(fundMe.fund()).to.be.revertedWith(
                "You need to spend more ETH!"
            );
        });
        it("updated the amount funded data structure", async function() {
            await fundMe.fund({ value: sendValue });
            const response = await fundMe.s_addressToAmountFunded(deployer);
            assert.equal(response.toString(), sendValue.toString());
        });
        it("add funder to array of funders ", async function() {
            await fundMe.fund({ value: sendValue });
            const funder = await fundMe.s_funders(0);
            assert.equal(funder, deployer);
        });
    });
    describe("withdraw", async function() {
        beforeEach(async function() {
            await fundMe.fund({ value: sendValue });
        });

        it("withdraw ETH from a single founder", async function() {
            //arrange
            const startingFundMeBalance = await fundMe.provider.getBalance(
                fundMe.address
            );
            const startingDeployerBalance = await fundMe.provider.getBalance(
                deployer
            );

            //act
            const transactionResponse = await fundMe.withdraw();
            const transactionReceipt = await transactionResponse.wait(1);
            // to  calculate gas used during withdraw func

            const { gasUsed, effectiveGasPrice } = transactionReceipt;
            const gasCost = gasUsed.mul(effectiveGasPrice);
            //

            const endingFundMeBalance = await fundMe.provider.getBalance(
                fundMe.address
            );
            const endingDeployerBalance = await fundMe.provider.getBalance(
                deployer
            );
            //assert
            assert.equal(endingFundMeBalance, 0);
            assert.equal(
                startingFundMeBalance.add(startingDeployerBalance).toString(),
                endingDeployerBalance.add(gasCost).toString()
            );
        });
        it("allows us to withdraw with multiple funders", async function() {
            //arrange
            const accounts = await ethers.getSigners();
            for (let i = 1; i < 6; i++) {
                const fundMeConnectedContract = await fundMe.connect(
                    accounts[i]
                );
                await fundMeConnectedContract.fund({ value: sendValue });
            }
            const startingFundMeBalance = await fundMe.provider.getBalance(
                fundMe.address
            );
            const startingDeployerBalance = await fundMe.provider.getBalance(
                deployer
            );

            //act
            const transactionResponse = await fundMe.withdraw();
            const transactionReceipt = await transactionResponse.wait(1);
            const { gasUsed, effectiveGasPrice } = transactionReceipt;
            const gasCost = gasUsed.mul(effectiveGasPrice);

            const endingFundMeBalance = await fundMe.provider.getBalance(
                fundMe.address
            );
            const endingDeployerBalance = await fundMe.provider.getBalance(
                deployer
            );
            //assert
            assert.equal(endingFundMeBalance, 0);
            assert.equal(
                startingFundMeBalance.add(startingDeployerBalance).toString(),
                endingDeployerBalance.add(gasCost).toString()
            );
            //make sure funders are reset properly

            await expect(fundMe.s_funders(0)).to.be.reverted;
            for (let i = 1; i < 6; i++) {
                assert.equal(
                    await fundMe.s_addressToAmountFunded(accounts[i].address),
                    "0"
                );
            }
        });
        it("only owner can withdraw funds", async function() {
            // const accounts = await ethers.getSigners();
            // const attacker = accounts[1];
            // const attackerConnectedContract = await fundMe.connect(attacker);
            // await expect(attackerConnectedContract.withdraw()).to.be.reverted;

            const accounts = await ethers.getSigners();
            const fundMeConnectedContract = await fundMe.connect(accounts[1]);
            await expect(fundMeConnectedContract.withdraw()).to.be.reverted;
        });
    });
});
